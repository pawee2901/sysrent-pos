import 'server-only';
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { getShop, type Shop } from '@/lib/shop';
import { adminKind, adminPerms, getCustomer, isShopAdmin, type Customer } from '@/lib/auth';
import type { Perm } from '@/lib/perms';

export const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** อ่าน JSON ตาม schema (ข้อความผิดพลาดแรกเป็นภาษาไทยที่ตั้งไว้ใน schema) */
export async function body<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { res: NextResponse }> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return { res: fail(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง') };
  return { data: parsed.data };
}

export async function requireShop(): Promise<{ shop: Shop } | { res: NextResponse }> {
  const shop = await getShop();
  return shop ? { shop } : { res: fail('ไม่พบร้าน', 404) };
}
export async function requireCustomer(): Promise<{ shop: Shop; me: Customer } | { res: NextResponse }> {
  const shop = await getShop();
  if (!shop) return { res: fail('ไม่พบร้าน', 404) };
  const me = await getCustomer();
  return me ? { shop, me } : { res: fail('กรุณาเข้าสู่ระบบ', 401) };
}
/** เฉพาะเจ้าของร้าน (ล็อกอินบัญชีแอดมินร้าน) — ลูกค้ายศแอดมินทำไม่ได้ เช่น ตั้ง/ถอดยศแอดมิน · เปลี่ยนรหัสหลังบ้าน */
export async function requireOwner(): Promise<{ shop: Shop } | { res: NextResponse }> {
  const shop = await getShop();
  if (!shop) return { res: fail('ไม่พบร้าน', 404) };
  return (await adminKind()) === 'owner' ? { shop } : { res: fail('เฉพาะเจ้าของร้าน (ล็อกอินบัญชีแอดมินร้าน) เท่านั้น', 403) };
}

/** แอดมินร้าน · perm = ต้องมีสิทธิ์เมนูนี้ (ระบุหลายอัน = มีอันใดอันหนึ่งก็พอ) · เจ้าของร้านผ่านทุกอัน */
export async function requireAdmin(perm?: Perm | Perm[]): Promise<{ shop: Shop } | { res: NextResponse }> {
  const shop = await getShop();
  if (!shop) return { res: fail('ไม่พบร้าน', 404) };
  if (!(await isShopAdmin())) return { res: fail('ไม่มีสิทธิ์', 403) };
  if (perm) {
    const mine = await adminPerms();
    const need = Array.isArray(perm) ? perm : [perm];
    if (!need.some((p) => mine.includes(p))) return { res: fail('คุณไม่มีสิทธิ์ใช้เมนูนี้ — ขอเจ้าของร้านเปิดสิทธิ์ให้', 403) };
  }
  return { shop };
}

/** ข้อผิดพลาดจากฟังก์ชันในฐานข้อมูล ('CODE:ชื่อสินค้า') → ข้อความลูกค้า */
export function dbFail(message = ''): NextResponse {
  const i = message.indexOf(':');
  const code = (i < 0 ? message : message.slice(0, i)).trim();
  const name = i < 0 ? '' : message.slice(i + 1).trim();
  const map: Record<string, [string, number]> = {
    EMPTY_CART: ['ตะกร้ายังว่างอยู่', 400], CART_TOO_BIG: ['สั่งได้สูงสุด 20 รายการ', 400],
    OPTION_UNAVAILABLE: ['มีสินค้าในตะกร้าที่ปิดขายแล้ว กรุณาลบออกแล้วลองใหม่', 409], OUT_OF_STOCK: [`${name || 'สินค้า'} หมดหรือเหลือไม่พอ`, 409],
    ORDER_NOT_FOUND: ['ไม่พบออเดอร์', 404], NOT_PENDING: ['ออเดอร์นี้ชำระเงินแล้ว', 409], ORDER_EXPIRED: ['ออเดอร์หมดเวลาชำระ (30 นาที) กรุณาสั่งใหม่', 410],
    INSUFFICIENT_FUNDS: ['ยอดเงินในกระเป๋าไม่พอ', 402], DUPLICATE_SLIP: ['สลิปนี้ถูกใช้ไปแล้ว', 409],
    NEED_INFO: [`กรุณากรอกข้อมูลที่ร้านขอสำหรับ ${name || 'สินค้า'} ในตะกร้า`, 400],
    COUPON_INVALID: ['โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุแล้ว', 400], COUPON_USED_UP: ['โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้ว', 409],
    COUPON_MIN: [`โค้ดนี้ใช้ได้เมื่อซื้อครบ ฿${Number(name || 0).toLocaleString('th-TH')}`, 400], COUPON_ALREADY_USED: ['คุณใช้โค้ดส่วนลดนี้ไปแล้ว', 409],
  };
  const hit = map[code];
  if (!hit) console.error('[shop] db error', message);
  return fail(hit?.[0] ?? 'ทำรายการไม่สำเร็จ กรุณาลองใหม่', hit?.[1] ?? 500);
}
