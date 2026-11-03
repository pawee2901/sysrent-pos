import 'server-only';
import { db } from '@/lib/db';
import { promptPayQrSvg } from '@/lib/promptpay';
import type { Shop } from '@/lib/shop';

export const QR_TTL_MS = 10 * 60_000;     // QR ใช้ได้ 10 นาที
export const SLIP_GRACE_MS = 10 * 60_000; // อัปสลิปได้อีก 10 นาทีหลัง QR หมด
export const MAX_ATTEMPTS = 5;            // 1 QR อัปสลิปได้ไม่เกิน 5 ครั้ง (กันเปลืองโควตาตรวจสลิปของร้าน)

export type TopupQr = { topupId: string; amount: number; expiresAt: string; deadline: string; qrSvg: string };
export type TopupErr = { error: string; status: number };

/** สร้าง QR พร้อมเพย์ของร้าน (เติมกระเป๋า หรือจ่ายออเดอร์ตรงเมื่อมี payOrder) */
export async function createTopup(shop: Shop, customerId: string, amount: number, payOrder: string | null): Promise<TopupQr | TopupErr> {
  if (!shop.promptpay_id) return { error: 'ร้านยังไม่ได้ตั้งค่าพร้อมเพย์ กรุณาติดต่อร้านทาง LINE', status: 503 };
  const d = db();
  const { count } = await d.from('shop_topups').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= 10) return { error: 'สร้าง QR บ่อยเกินไป กรุณาลองใหม่ภายหลัง', status: 429 };
  await d.from('shop_topups').update({ status: 'cancelled' }).eq('customer_id', customerId).eq('status', 'pending');
  const { data, error } = await d.from('shop_topups').insert({
    shop_id: shop.id, customer_id: customerId, amount, pay_order: payOrder, expires_at: new Date(Date.now() + QR_TTL_MS).toISOString(),
  }).select('id, amount, expires_at').single();
  if (error || !data) return { error: 'สร้าง QR ไม่สำเร็จ กรุณาลองใหม่', status: 500 };
  let qrSvg: string;
  try { qrSvg = await promptPayQrSvg(shop.promptpay_id, amount); } catch { return { error: 'เลขพร้อมเพย์ของร้านไม่ถูกต้อง กรุณาติดต่อร้าน', status: 503 }; }
  return {
    topupId: data.id as string, amount: Number(data.amount), expiresAt: data.expires_at as string,
    deadline: new Date(new Date(data.expires_at).getTime() + SLIP_GRACE_MS).toISOString(), qrSvg,
  };
}
