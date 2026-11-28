import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { body, fail } from '@/lib/api';
import { getShop } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { otpAccounts } from '@/lib/otp-access';
import { otpPublic } from '@/lib/otp-link';
import { notifyOtpAsk } from '@/lib/notify';

const schema = z.object({ itemId: z.string().uuid(), account: z.string().trim().toLowerCase().email().max(120), note: z.string().trim().min(1, 'เขียนเหตุผลสั้น ๆ ให้แอดมิน').max(500) });

/** ลูกค้าขอ OTP ครบแล้ว → ส่งคำขอเพิ่ม (ออเดอร์ละ 1 คำขอที่รออยู่) · แอดมินอนุมัติที่หลังบ้าน → ค้นหาได้อีก */
export async function POST(req: Request) {
  const shop = await getShop();
  if (!shop || !can(shop.plan, 'otp')) return fail('ร้านนี้ยังไม่เปิดใช้งานค้นหา OTP', 403);
  const me = await getCustomer();
  if (!me && !(await otpPublic(shop.id))) return fail('กรุณาเข้าสู่ระบบก่อน', 401);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const { itemId, account, note } = b.data, d = db();
  // ต้องเป็นอีเมลของออเดอร์นี้จริง (ลูกค้าที่ล็อกอิน = ของตัวเอง · หน้ารับ OTP = ของร้านที่ยังไม่หมดอายุ)
  const acc = (await otpAccounts(shop.id, me?.id)).find((a) => a.email === account);
  if (!acc || !acc.items.includes(itemId)) return fail('ไม่พบออเดอร์ของอีเมลนี้', 404);
  const { count, error } = await d.from('shop_otp_asks').select('id', { count: 'exact', head: true }).eq('order_item_id', itemId).eq('status', 'open');
  if (error) return fail('ร้านยังไม่เปิดรับคำขอ OTP เพิ่ม', 503);
  if (count) return fail('ส่งคำขอไปแล้ว กรุณารอแอดมินอนุมัติ', 409);
  const { error: ie } = await d.from('shop_otp_asks').insert({ shop_id: shop.id, order_item_id: itemId, customer_id: me?.id ?? null, account, note });
  if (ie) return fail('ส่งคำขอไม่สำเร็จ', 500);
  notifyOtpAsk(shop, me?.username ?? '', account, acc.product, note);
  return NextResponse.json({ ok: true });
}
