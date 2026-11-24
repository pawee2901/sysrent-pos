/* =============================================================
   Web Push (แจ้งเตือนบนมือถือ / คอม) — เขียนเองด้วย node:crypto ไม่พึ่ง library
   · VAPID (RFC 8292): JWT ES256 ยืนยันว่าเป็นเซิร์ฟเวอร์ของเรา
   · เข้ารหัสข้อความ aes128gcm (RFC 8291 + RFC 8188)
   กุญแจ VAPID: ใช้ env VAPID_PUBLIC_KEY / VAPID_PRIVATE_JWK ถ้ามี · ไม่มี = สร้างครั้งแรกแล้วเก็บในตาราง app_push_keys
   ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
   ============================================================= */
import 'server-only';
import { createCipheriv, createECDH, createPrivateKey, generateKeyPairSync, hkdfSync, randomBytes, sign, type JsonWebKey } from 'node:crypto';
import { db } from '@/lib/db';

const b64u = (b: Buffer) => b.toString('base64url');
const unb64u = (s: string) => Buffer.from(s, 'base64url');

type Keys = { publicKey: string; jwk: JsonWebKey };
let cached: Keys | null = null;

/** กุญแจ VAPID ของเซิร์ฟเวอร์ (สร้างครั้งแรกถ้ายังไม่มี) · null = ยังไม่รัน SQL 0038 */
export async function vapidKeys(): Promise<Keys | null> {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_JWK) {
    cached = { publicKey: process.env.VAPID_PUBLIC_KEY, jwk: JSON.parse(process.env.VAPID_PRIVATE_JWK) as JsonWebKey };
    return cached;
  }
  const d = db();
  const { data, error } = await d.from('app_push_keys').select('public_key, private_jwk').eq('id', 1).maybeSingle();
  if (error) return null;
  if (data) { cached = { publicKey: data.public_key, jwk: data.private_jwk as JsonWebKey }; return cached; }
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pub = b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x!), unb64u(jwk.y!)]));
  // insert แบบไม่ทับ: ถ้าเซิร์ฟเวอร์อีกตัวสร้างพร้อมกัน ใช้ของที่บันทึกก่อน
  await d.from('app_push_keys').upsert({ id: 1, public_key: pub, private_jwk: jwk }, { onConflict: 'id', ignoreDuplicates: true });
  const { data: saved } = await d.from('app_push_keys').select('public_key, private_jwk').eq('id', 1).maybeSingle();
  if (!saved) return null;
  cached = { publicKey: saved.public_key, jwk: saved.private_jwk as JsonWebKey };
  return cached;
}

function vapidHeader(endpoint: string, keys: Keys): string {
  const aud = new URL(endpoint).origin;
  const head = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(Buffer.from(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: `mailto:${process.env.VAPID_CONTACT || 'noreply@sysrent.shop'}` })));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key: createPrivateKey({ key: keys.jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.publicKey}`;
}

/** เข้ารหัสข้อความตาม RFC 8291 (aes128gcm, record เดียว) */
function encrypt(payload: Buffer, p256dh: string, auth: string): Buffer {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  const ecdh = createECDH('prime256v1');
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url?: string; icon?: string; tag?: string };

/** ส่ง 1 เครื่อง · 'gone' = เครื่องยกเลิกแล้ว (ลบออกได้) */
export async function sendPush(sub: PushSub, msg: PushMessage): Promise<'ok' | 'gone' | 'failed'> {
  const keys = await vapidKeys();
  if (!keys) return 'failed';
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { Authorization: vapidHeader(sub.endpoint, keys), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' },
      body: new Uint8Array(encrypt(Buffer.from(JSON.stringify(msg)), sub.p256dh, sub.auth)),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) { console.error('[push]', res.status, (await res.text().catch(() => '')).slice(0, 200)); return 'failed'; }
    return 'ok';
  } catch (e) { console.error('[push]', e); return 'failed'; }
}
