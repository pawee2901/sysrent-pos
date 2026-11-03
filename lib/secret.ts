import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * เข้ารหัสรหัสผ่านบัญชีหลักก่อนเก็บในฐานข้อมูล (AES-256-GCM, กุญแจจาก ENC_KEY ใน .env)
 * ฐานข้อมูลหลุดอย่างเดียวอ่านรหัสไม่ได้ · ห้ามเปลี่ยน ENC_KEY หลังมีบัญชีแล้ว (รหัสเดิมจะถอดไม่ออก)
 * รูปแบบ: v1.<iv>.<tag>.<ciphertext> (base64url)
 */
function key(): Buffer {
  const k = process.env.ENC_KEY ?? '';
  if (k.length < 32) throw new Error('ENC_KEY ต้องยาวอย่างน้อย 32 ตัวอักษร (ตั้งใน .env.local)');
  return createHash('sha256').update(k).digest();
}

export function encConfigured() {
  return (process.env.ENC_KEY ?? '').length >= 32;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function decrypt(blob: string): string {
  const [v, iv, tag, ct] = blob.split('.');
  if (v !== 'v1' || !iv || !tag || ct === undefined) throw new Error('bad secret format');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}
