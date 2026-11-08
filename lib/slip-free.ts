import 'server-only';
import { db } from '@/lib/db';
import { bankAutoOn } from '@/lib/bank';
import { readSlipAi, readSlipQr, slipAiConfigured } from '@/lib/slip-read';
import { receiverIsShop } from '@/lib/slip-receiver';
import type { Shop } from '@/lib/shop';

/** สลิปอย่างเดียว (ไม่มีแจ้งเตือนเงินเข้ายืนยัน) เติมได้ไม่เกินยอดนี้ — กันสลิปปลอมยอดสูง */
const SLIP_ONLY_MAX = Number(process.env.SLIP_AUTO_MAX ?? 200);
const SKEW = 60_000;

type Topup = { id: string; amount: number; created_at: string; expires_at: string; pay_order: string | null };
export type FreeSlipResult =
  | { kind: 'paid'; topupId: string; amount: number }
  | { kind: 'waiting'; message: string }
  | { kind: 'error'; message: string; status: number };

const err = (message: string, status = 400): FreeSlipResult => ({ kind: 'error', message, status });

/**
 * ตรวจสลิปเอง (ไม่ใช้ SlipOK):
 * QR บนสลิป → กันซ้ำ · AI อ่านยอด/ผู้รับ/เวลา (ถ้ามีคีย์) →
 *   เปิดรับเงินอัตโนมัติอยู่: หาแจ้งเตือนเงินเข้าที่ยังไม่มีเจ้าของ ยอดตรงสลิป → เติมเลย (เงินเข้าจริงแล้ว)
 *                           ไม่เจอ → "สลิปถูกต้อง รอเงินเข้า" (แจ้งเตือนมาเมื่อไหร่ เติมให้เอง)
 *   ไม่ได้เปิด: เชื่อสลิป + AI ได้เฉพาะยอดไม่เกิน SLIP_ONLY_MAX
 */
export async function checkSlipFree(shop: Shop, customerId: string, t: Topup, buf: Buffer): Promise<FreeSlipResult> {
  const d = db();
  const amount = Number(t.amount);

  const qr = await readSlipQr(buf);
  if (!qr) return err('อ่าน QR บนสลิปไม่ได้ — ใช้รูปสลิปจากแอปธนาคารแบบเต็มใบ ไม่ครอป ไม่ถ่ายจากจอ');
  const { data: used } = await d.from('shop_topups').select('id').eq('shop_id', shop.id).eq('slip_ref', qr.transRef).neq('id', t.id).limit(1);
  if (used?.length) return err('สลิปนี้ถูกใช้ไปแล้ว', 409);

  const ai = await readSlipAi(buf);
  if (ai) {
    if (!ai.is_transfer_slip) return err('รูปนี้ไม่ใช่สลิปโอนเงิน');
    if (ai.receiver_name || ai.receiver_account) {
      const ok = receiverIsShop({ displayName: ai.receiver_name ?? '', account: { value: ai.receiver_account ?? '' }, proxy: { value: ai.receiver_account ?? '' } }, shop);
      if (!ok) return err('บัญชีผู้รับในสลิปไม่ใช่บัญชีของร้านนี้');
    }
    const paidAt = ai.paid_at ? Date.parse(ai.paid_at) : NaN;
    if (Number.isFinite(paidAt) && paidAt < new Date(t.created_at).getTime() - 5 * SKEW) return err('สลิปนี้โอนก่อนสร้างรายการ ใช้ไม่ได้');
  }

  // ผูกสลิปกับรายการนี้ (unique ต่อร้าน: ชนกัน = มีคนใช้สลิปนี้ไปพร้อมกันพอดี)
  const { error: refErr } = await d.from('shop_topups').update({ slip_ref: qr.transRef, slip: { source: 'slip-free', qr: qr.raw.slice(0, 200), ai } }).eq('id', t.id);
  if (refErr) return refErr.code === '23505' ? err('สลิปนี้ถูกใช้ไปแล้ว', 409) : err('บันทึกสลิปไม่สำเร็จ กรุณาลองใหม่', 500);

  const slipAmount = ai?.amount ?? null;
  if (await bankAutoOn(shop.id)) {
    // เงินเข้าแล้วแต่ไม่มีเจ้าของ (มักเพราะลูกค้าโอนไม่ตรงสตางค์) + สลิปยืนยันยอดนั้น → เติมยอดที่เข้าจริง
    const want = slipAmount ?? amount;
    const { data: evs } = await d.from('shop_bank_events').select('id, amount, dedupe').eq('shop_id', shop.id).eq('result', 'no_match').is('topup_id', null)
      .eq('amount', want).gte('created_at', new Date(new Date(t.created_at).getTime() - SKEW).toISOString()).limit(2);
    if (evs?.length === 1) {
      const ev = evs[0];
      if (Number(ev.amount) !== amount) {
        const { error } = await d.from('shop_topups').update({ amount: Number(ev.amount) }).eq('id', t.id);
        if (error) return { kind: 'waiting', message: 'สลิปถูกต้อง ✓ แต่ยอดไม่ตรงกับ QR — ร้านจะตรวจและเติมให้' };
      }
      const { error } = await d.rpc('shop_credit_bank', { p_topup: t.id, p_ref: `bank:${String(ev.dedupe).slice(0, 24)}`, p_info: { source: 'slip+bank', slip_ref: qr.transRef, ai } });
      if (error) { console.error('[slip-free] credit', error.message); return err('บันทึกยอดเงินไม่สำเร็จ กรุณาติดต่อร้านพร้อมสลิป', 500); }
      await d.from('shop_bank_events').update({ result: 'matched', topup_id: t.id }).eq('id', ev.id);
      return { kind: 'paid', topupId: t.id, amount: Number(ev.amount) };
    }
    if (slipAmount !== null && Math.abs(slipAmount - amount) >= 0.005) return err(`ยอดในสลิป ฿${slipAmount.toFixed(2)} ไม่ตรงกับยอดที่ต้องโอน ฿${amount.toFixed(2)} — ถ้าโอนไปแล้ว ร้านจะตรวจและเติมให้`);
    return { kind: 'waiting', message: 'สลิปถูกต้อง ✓ รอเงินเข้าบัญชีร้านสักครู่ ระบบจะเติมให้อัตโนมัติ' };
  }

  // ไม่มีแจ้งเตือนเงินเข้ายืนยัน → เชื่อสลิปได้แค่ยอดเล็ก และต้องมี AI อ่านยอด
  if (!ai || !slipAiConfigured()) return err('ร้านยังไม่เปิดระบบตรวจอัตโนมัติ กรุณาส่งสลิปให้ร้านทาง LINE', 503);
  if (slipAmount === null || Math.abs(slipAmount - amount) >= 0.005) return err(`ยอดในสลิป${slipAmount !== null ? ` ฿${slipAmount.toFixed(2)}` : ''} ไม่ตรงกับยอดที่ต้องโอน ฿${amount.toFixed(2)}`);
  if (amount > SLIP_ONLY_MAX) return err(`ยอดเกิน ฿${SLIP_ONLY_MAX} ต้องให้ร้านตรวจ กรุณาส่งสลิปให้ร้านทาง LINE`, 403);
  const { error } = await d.rpc('shop_credit_bank', { p_topup: t.id, p_ref: `slip:${qr.transRef}`.slice(0, 120), p_info: { source: 'slip-ai', slip_ref: qr.transRef, ai } });
  if (error) { console.error('[slip-free] credit', error.message); return err('บันทึกยอดเงินไม่สำเร็จ กรุณาติดต่อร้านพร้อมสลิป', 500); }
  void customerId;
  return { kind: 'paid', topupId: t.id, amount };
}
