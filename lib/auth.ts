import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from '@/lib/db';
import { getShop } from '@/lib/shop';

/**
 * ล็อกอินของแต่ละร้าน (แยกจากบัญชี SysRent)
 * - ลูกค้าร้าน: shop_customers (ชื่อผู้ใช้ + รหัสผ่าน) · แอดมินร้าน: shops.admin_username + admin_pass_hash
 * - session = token สุ่มใน cookie (httpOnly) เก็บแค่ sha256 ในฐานข้อมูล · cookie ผูกกับ subdomain ของร้านเท่านั้น
 */
const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const CUSTOMER_COOKIE = 'sid';
export const ADMIN_COOKIE = 'asid';
const DAY = 86_400_000;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `s1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [v, salt, key] = stored.split('$');
  if (v !== 's1' || !salt || !key) return false;
  const want = Buffer.from(key, 'base64url');
  const got = await scrypt(pw, Buffer.from(salt, 'base64url'), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** สร้าง session ใหม่ แล้วตั้ง cookie (เรียกจาก route handler) */
export async function startSession(shopId: string, customerId: string | null, days: number) {
  const token = randomBytes(32).toString('base64url');
  await db().from('shop_sessions').insert({ token_hash: sha(token), shop_id: shopId, customer_id: customerId, expires_at: new Date(Date.now() + days * DAY).toISOString() });
  (await cookies()).set(customerId ? CUSTOMER_COOKIE : ADMIN_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: days * 86_400,
  });
}
export async function endSession(kind: 'customer' | 'admin') {
  const name = kind === 'customer' ? CUSTOMER_COOKIE : ADMIN_COOKIE;
  const jar = await cookies();
  const t = jar.get(name)?.value;
  if (t) await db().from('shop_sessions').delete().eq('token_hash', sha(t));
  jar.delete(name);
}

async function sessionOf(name: string, shopId: string) {
  const t = (await cookies()).get(name)?.value;
  if (!t || t.length > 100) return null;
  const { data } = await db().from('shop_sessions').select('customer_id, expires_at').eq('token_hash', sha(t)).eq('shop_id', shopId).maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

export type Customer = { id: string; username: string; contact: string; balance: number };

/** ลูกค้าที่ล็อกอินอยู่ในร้านนี้ */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const shop = await getShop();
  if (!shop) return null;
  const s = await sessionOf(CUSTOMER_COOKIE, shop.id);
  if (!s?.customer_id) return null;
  const { data } = await db().from('shop_customers').select('id, username, contact, balance, blocked').eq('id', s.customer_id).eq('shop_id', shop.id).maybeSingle();
  if (!data || data.blocked) return null;
  return { id: data.id, username: data.username, contact: data.contact, balance: Number(data.balance) };
});

/** แอดมินร้านล็อกอินอยู่ไหม */
export const isShopAdmin = cache(async (): Promise<boolean> => {
  const shop = await getShop();
  if (!shop) return false;
  const s = await sessionOf(ADMIN_COOKIE, shop.id);
  return !!s && s.customer_id === null;
});

/** IP ลูกค้า (หลัง nginx / Cloudflare) สำหรับนับล็อกอินผิด */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('cf-connecting-ip') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** กันเดารหัส: ผิด 5 ครั้งใน 15 นาที → ล็อก 15 นาที (นับต่อร้าน + IP และ ต่อร้าน + ชื่อผู้ใช้) */
export async function loginLocked(keys: string[]): Promise<boolean> {
  const { data } = await db().from('shop_login_fails').select('locked_until').in('key', keys);
  return (data ?? []).some((r) => r.locked_until && new Date(r.locked_until).getTime() > Date.now());
}
export async function loginFailed(keys: string[]) {
  const d = db();
  for (const key of keys) {
    const { data } = await d.from('shop_login_fails').select('fails, locked_until').eq('key', key).maybeSingle();
    const expired = data?.locked_until && new Date(data.locked_until).getTime() < Date.now();
    const fails = (expired ? 0 : data?.fails ?? 0) + 1;
    await d.from('shop_login_fails').upsert({ key, fails: fails >= 5 ? 0 : fails, locked_until: fails >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null });
  }
}
export async function loginOk(keys: string[]) {
  await db().from('shop_login_fails').delete().in('key', keys);
}
