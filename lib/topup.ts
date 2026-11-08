import 'server-only';
import { db } from '@/lib/db';
import { promptPayQrSvg } from '@/lib/promptpay';
import type { Shop } from '@/lib/shop';
import { bankAutoOn, uniqueAmount } from '@/lib/bank';
import { slipServiceConfigured } from '@/lib/slip-service';
import { slipAiConfigured } from '@/lib/slip-read';

export const QR_TTL_MS = 10 * 60_000;     // QR ใช้ได้ 10 นาที
export const SLIP_GRACE_MS = 10 * 60_000; // อัปสลิปได้อีก 10 นาทีหลัง QR หมด
export const MAX_ATTEMPTS = 5;            // 1 QR อัปสลิปได้ไม่เกิน 5 ครั้ง (กันเปลืองโควตาตรวจสลิปของร้าน)

export type TopupQr = { topupId: string; amount: number; expiresAt: string; deadline: string; qrSvg: string; auto: boolean; slip: boolean };
export type TopupErr = { error: string; status: number };

/** สร้าง QR พร้อมเพย์ของร้าน (เติมกระเป๋า หรือจ่ายออเดอร์ตรงเมื่อมี payOrder) */
export async function createTopup(shop: Shop, customerId: string, amount: number, payOrder: string | null): Promise<TopupQr | TopupErr> {
  if (!shop.promptpay_id) return { error: 'ร้านยังไม่ได้ตั้งค่าพร้อมเพย์ กรุณาติดต่อร้านทาง LINE', status: 503 };
  const d = db();
  const { count } = await d.from('shop_topups').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= 10) return { error: 'สร้าง QR บ่อยเกินไป กรุณาลองใหม่ภายหลัง', status: 429 };
  await d.from('shop_topups').update({ status: 'cancelled' }).eq('customer_id', customerId).eq('status', 'pending');
  // รายการที่เลยเวลาแล้ว → หมดอายุ (คืนยอดให้คนอื่นใช้ได้)
  await d.from('shop_topups').update({ status: 'expired' }).eq('shop_id', shop.id).eq('status', 'pending').lt('expires_at', new Date(Date.now() - SLIP_GRACE_MS).toISOString());

  // รับเงินอัตโนมัติ = ยอดมีเศษสตางค์ไม่ซ้ำ (ระบบรู้ว่าเงินก้อนไหนของใคร) · ไม่เปิด = ยอดตรงตามที่ขอ
  const auto = await bankAutoOn(shop.id);
  const tries = auto ? await uniqueAmount(shop.id, amount) : [amount];
  if (!tries.length) return { error: 'มีคนรอโอนยอดนี้เยอะเกินไป กรุณาลองใหม่ในอีกสักครู่', status: 503 };
  let data: { id: string; amount: number; expires_at: string } | null = null;
  for (const amt of tries) {
    const r = await d.from('shop_topups').insert({
      shop_id: shop.id, customer_id: customerId, amount: amt, pay_order: payOrder, expires_at: new Date(Date.now() + QR_TTL_MS).toISOString(),
    }).select('id, amount, expires_at').single();
    if (!r.error && r.data) { data = r.data; break; }
    if (r.error?.code !== '23505') break; // 23505 = มีคนได้ยอดนี้พร้อมกันพอดี → ลองยอดถัดไป
  }
  if (!data) return { error: 'สร้าง QR ไม่สำเร็จ กรุณาลองใหม่', status: 500 };
  const pay = Number(data.amount);
  let qrSvg: string;
  try { qrSvg = await promptPayQrSvg(shop.promptpay_id, pay); } catch { return { error: 'เลขพร้อมเพย์ของร้านไม่ถูกต้อง กรุณาติดต่อร้าน', status: 503 }; }
  return {
    topupId: data.id, amount: pay, expiresAt: data.expires_at,
    deadline: new Date(new Date(data.expires_at).getTime() + SLIP_GRACE_MS).toISOString(), qrSvg,
    // อัปสลิปได้เมื่อ: มีบริการตรวจสลิป (Thunder / SlipOK) · หรือเปิดรับเงินอัตโนมัติ (สลิปช่วยจับคู่) · หรือมี AI อ่านสลิป
    auto, slip: slipServiceConfigured() || auto || slipAiConfigured(),
  };
}
