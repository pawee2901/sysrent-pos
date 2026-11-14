import 'server-only';
import { db } from '@/lib/db';
import { slipServiceConfigured, verifySlip } from '@/lib/slip-service';
import { receiverIsShop } from '@/lib/slip-receiver';
import { MAX_ATTEMPTS, SLIP_GRACE_MS } from '@/lib/topup';
import { checkSlipFree } from '@/lib/slip-free';
import { notifyOrderPaid, notifyTopup } from '@/lib/notify';
import type { Shop } from '@/lib/shop';

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SKEW = 60_000;

export type TopupSlipResult =
  | { ok: true; amount: number; order?: string; balance?: number; orderError?: string; waiting?: boolean; message?: string }
  | { ok: false; error: string; status: number; expired?: boolean };

/**
 * ตรวจสลิปของรายการเติมเงิน / จ่ายออเดอร์ — ใช้ร่วมกันทั้งหน้าเว็บร้าน (/api/topup/[id]/slip) และแชท LINE ของร้าน
 * โควตาตรวจสลิปของร้าน → Thunder / SlipOK → ยอดตรง + ผู้รับเป็นร้านนี้ + เวลาโอนอยู่ในช่วง QR → เงินเข้ากระเป๋า (+ จ่ายออเดอร์ต่อ)
 * ไม่มีบริการตรวจสลิป → ตรวจเอง (QR บนสลิป + AI + แจ้งเตือนเงินเข้า)
 */
export async function verifyTopupSlip(shop: Shop, me: { id: string; username: string }, topupId: string, file: Blob | null): Promise<TopupSlipResult> {
  const no = (error: string, status = 400, expired?: boolean): TopupSlipResult => ({ ok: false, error, status, ...(expired ? { expired } : {}) });
  const d = db();
  const { data: t } = await d.from('shop_topups').select('id, amount, status, attempts, pay_order, created_at, expires_at')
    .eq('id', topupId).eq('shop_id', shop.id).eq('customer_id', me.id).maybeSingle();
  if (!t) return no('ไม่พบรายการ', 404);
  if (t.status === 'paid') return no('รายการนี้ชำระเรียบร้อยแล้ว', 409);
  if (t.status !== 'pending') return no('รายการนี้หมดเวลาแล้ว กรุณาสร้าง QR ใหม่', 410, true);
  const created = new Date(t.created_at).getTime();
  const expires = new Date(t.expires_at).getTime();
  if (Date.now() > expires + SLIP_GRACE_MS) {
    await d.from('shop_topups').update({ status: 'expired' }).eq('id', t.id).eq('status', 'pending');
    return no('เกินเวลาตรวจสลิป หากโอนแล้วกรุณาติดต่อร้านพร้อมสลิป', 410, true);
  }
  if (t.attempts >= MAX_ATTEMPTS) return no('อัปสลิปเกินจำนวนครั้ง กรุณาติดต่อร้าน', 429);

  if (!(file instanceof Blob) || !file.size) return no('กรุณาเลือกรูปสลิป');
  if (file.size > 5 * 1024 * 1024) return no('ไฟล์ใหญ่เกิน 5MB');
  if (!TYPES.has(file.type)) return no('รองรับเฉพาะรูป jpg, png, webp');

  // QR นี้มาจากออเดอร์ → จ่ายต่อจากกระเป๋าทันที (ออเดอร์หมดเวลา/ของหมด = เงินยังอยู่ในกระเป๋า ไม่หาย)
  const finish = async (amount: number, balance?: number): Promise<TopupSlipResult> => {
    if (t.pay_order) {
      const { data: o, error: pErr } = await d.rpc('shop_pay_order', { p_order: t.pay_order, p_customer: me.id, p_paid_by: 'promptpay' });
      if (!pErr && o) { notifyOrderPaid(shop, t.pay_order); return { ok: true, amount, order: (o as { code: string }).code }; }
      notifyTopup(shop, me.username, amount); // ออเดอร์จ่ายไม่สำเร็จ แต่เงินเข้ากระเป๋าแล้ว
      return { ok: true, amount, balance, orderError: 'เงินเข้ากระเป๋าแล้ว แต่ออเดอร์จ่ายไม่สำเร็จ (อาจหมดเวลาหรือของหมด) — สั่งใหม่แล้วจ่ายด้วยกระเป๋าได้เลย' };
    }
    notifyTopup(shop, me.username, amount);
    return { ok: true, amount, balance };
  };

  if (!slipServiceConfigured()) {
    await d.from('shop_topups').update({ attempts: t.attempts + 1 }).eq('id', t.id);
    const r = await checkSlipFree(shop, me.id, { ...t, amount: Number(t.amount) }, Buffer.from(await file.arrayBuffer()));
    if (r.kind === 'error') { await d.from('shop_topups').update({ last_error: r.message }).eq('id', t.id); return no(r.message, r.status); }
    if (r.kind === 'waiting') return { ok: true, amount: Number(t.amount), waiting: true, message: r.message };
    return finish(r.amount);
  }

  // โควตาตรวจสลิปของร้าน (นับก่อนส่งไปตรวจ เพราะบริการตรวจสลิปคิดเงินทุกครั้ง)
  const { data: allowed, error: qErr } = await d.rpc('shop_use_slip', { p_shop: shop.id });
  if (qErr) { console.error('[slip] quota', qErr.message); return no('ระบบตรวจสลิปขัดข้อง กรุณาลองใหม่', 500); }
  if (!allowed) return no('ร้านใช้โควตาตรวจสลิปเดือนนี้ครบแล้ว — ระบบยังรับเงินไม่ได้ชั่วคราว กรุณาติดต่อร้านทาง LINE', 503);

  await d.from('shop_topups').update({ attempts: t.attempts + 1 }).eq('id', t.id);
  const amount = Number(t.amount);
  const r = await verifySlip(file, amount);
  const bad = async (msg: string, status = 400) => { await d.from('shop_topups').update({ last_error: msg }).eq('id', t.id); return no(msg, status); };
  if (!r.ok) return bad(r.message, r.retryable ? 503 : 400);
  const s = r.data;
  if (Math.abs(Number(s.amount) - amount) >= 0.005) return bad(`ยอดในสลิป ฿${s.amount} ไม่ตรงกับยอดที่ต้องโอน ฿${amount}`);
  if (!receiverIsShop(s.receiver, shop)) return bad('บัญชีผู้รับในสลิปไม่ใช่บัญชีของร้านนี้');
  const paidAt = Date.parse(s.transTimestamp);
  if (!Number.isFinite(paidAt) || paidAt < created - SKEW) return bad('สลิปนี้โอนก่อนสร้างรายการ ใช้ไม่ได้');
  if (paidAt > expires + SKEW) return bad('โอนหลัง QR หมดอายุ กรุณาติดต่อร้านพร้อมสลิป');

  const slip = { transRef: s.transRef, at: s.transTimestamp, amount: s.amount, sender: s.sender?.displayName || s.sender?.name || null, bank: s.sendingBank ?? null };
  const { data: balance, error } = await d.rpc('shop_credit_topup', { p_topup: t.id, p_ref: s.transRef, p_slip: slip });
  if (error) {
    if (/DUPLICATE_SLIP/.test(error.message) || error.code === '23505') return bad('สลิปนี้ถูกใช้ไปแล้ว', 409);
    if (/NOT_PENDING/.test(error.message)) return no('รายการนี้ชำระเรียบร้อยแล้ว', 409);
    console.error('[slip] credit', error.message);
    return bad('บันทึกยอดเงินไม่สำเร็จ กรุณาติดต่อร้านพร้อมสลิป', 500);
  }
  return finish(amount, Number(balance));
}
