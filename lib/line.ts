import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/secret';

/**
 * LINE OA ของแต่ละร้าน (Messaging API) — ร้านใส่ Channel secret + access token เองในหลังบ้าน → เก็บแบบเข้ารหัส (shop_line)
 * Webhook URL ของร้าน = https://<slug>.sysrent.shop/api/line/webhook (รู้ว่าร้านไหนจากโดเมน)
 */
export type ShopLine = { secret: string; token: string; botName: string; basicId: string };
export type LineMessage = Record<string, unknown>;

const cache = new Map<string, { v: ShopLine | null; at: number }>();

/** LINE ของร้าน (ถอดรหัสแล้ว) · จำไว้ 1 นาที · ไม่ได้เชื่อม / ยังไม่รัน 0028 = null */
export async function shopLine(shopId: string): Promise<ShopLine | null> {
  const hit = cache.get(shopId);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  const { data, error } = await db().from('shop_line').select('secret_enc, token_enc, bot_name, basic_id').eq('shop_id', shopId).maybeSingle();
  let v: ShopLine | null = null;
  if (!error && data) {
    try { v = { secret: decrypt(data.secret_enc), token: decrypt(data.token_enc), botName: data.bot_name, basicId: data.basic_id }; } catch { v = null; }
  }
  cache.set(shopId, { v, at: Date.now() });
  return v;
}

export async function saveShopLine(shopId: string, secret: string, token: string, info: { botName: string; basicId: string }) {
  cache.delete(shopId);
  return db().from('shop_line').upsert({
    shop_id: shopId, secret_enc: encrypt(secret), token_enc: encrypt(token), bot_name: info.botName, basic_id: info.basicId, updated_at: new Date().toISOString(),
  }, { onConflict: 'shop_id' });
}
export async function deleteShopLine(shopId: string) {
  cache.delete(shopId);
  return db().from('shop_line').delete().eq('shop_id', shopId);
}

/** ลายเซ็น webhook ตรงกับ Channel secret ของร้านไหม */
export function lineSignatureOk(secret: string, raw: string, signature: string | null): boolean {
  if (!signature) return false;
  const want = Buffer.from(createHmac('sha256', secret).update(raw).digest('base64'));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

async function call(token: string, path: string, init: RequestInit = {}, base = 'https://api.line.me'): Promise<Response | null> {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
}

async function send(token: string, path: 'reply' | 'push', body: unknown): Promise<boolean> {
  const r = await call(token, `/v2/bot/message/${path}`, { method: 'POST', body: JSON.stringify(body) });
  if (!r?.ok) { console.error(`[line] ${path} failed`, r?.status, await r?.text().catch(() => '')); return false; }
  return true;
}
export const replyLine = (token: string, replyToken: string, messages: LineMessage[]) => send(token, 'reply', { replyToken, messages: messages.slice(0, 5) });
export const pushLine = (token: string, to: string, messages: LineMessage[]) => send(token, 'push', { to, messages: messages.slice(0, 5) });

/** ข้อมูลบอท (ใช้ตรวจว่า token ถูก ตอนร้านเชื่อม LINE) */
export async function lineBotInfo(token: string): Promise<{ botName: string; basicId: string } | null> {
  const r = await call(token, '/v2/bot/info');
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => null)) as { displayName?: string; basicId?: string } | null;
  return j ? { botName: j.displayName ?? '', basicId: j.basicId ?? '' } : null;
}
/** Webhook URL ที่ตั้งไว้ใน LINE + เปิดใช้อยู่ไหม */
export async function lineWebhookInfo(token: string): Promise<{ endpoint: string; active: boolean } | null> {
  const r = await call(token, '/v2/bot/channel/webhook/endpoint');
  if (!r?.ok) return null;
  return (await r.json().catch(() => null)) as { endpoint: string; active: boolean } | null;
}
/** ให้ LINE ยิงทดสอบเข้า Webhook ของร้าน */
export async function lineWebhookTest(token: string): Promise<{ success: boolean; statusCode?: number; reason?: string } | null> {
  const r = await call(token, '/v2/bot/channel/webhook/test', { method: 'POST', body: '{}' });
  return r ? ((await r.json().catch(() => null)) as { success: boolean; statusCode?: number; reason?: string } | null) : null;
}

export async function lineDisplayName(token: string, userId: string): Promise<string> {
  const r = await call(token, `/v2/bot/profile/${encodeURIComponent(userId)}`);
  if (!r?.ok) return '';
  const j = (await r.json().catch(() => null)) as { displayName?: string } | null;
  return (j?.displayName ?? '').slice(0, 60);
}

/** รูปที่ลูกค้าส่งมาในแชท (สลิป) */
export async function lineContent(token: string, messageId: string): Promise<Blob | null> {
  const r = await call(token, `/v2/bot/message/${encodeURIComponent(messageId)}/content`, {}, 'https://api-data.line.me');
  if (!r?.ok) return null;
  const blob = await r.blob();
  if (!blob.size || blob.size > 5 * 1024 * 1024) return null;
  return blob.type.startsWith('image/') ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/jpeg' });
}

/** จุด "กำลังพิมพ์..." ระหว่างตรวจสลิป */
export async function lineLoading(token: string, userId: string, seconds = 20) {
  await call(token, '/v2/bot/chat/loading/start', { method: 'POST', body: JSON.stringify({ chatId: userId, loadingSeconds: Math.min(60, Math.max(5, Math.round(seconds / 5) * 5)) }) });
}

/** ลายเซ็นลิงก์รูป QR (กันคนเดาลิงก์) */
export function signLink(s: string): string {
  return createHmac('sha256', `qr:${process.env.ENC_KEY ?? ''}`).update(s).digest('base64url').slice(0, 24);
}
export function signLinkOk(s: string, sig: string | null): boolean {
  if (!sig) return false;
  const a = Buffer.from(signLink(s)), b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
