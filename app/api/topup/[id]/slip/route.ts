import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, isUuid, requireCustomer } from '@/lib/api';
import { checkSlip, slipOkConfigured } from '@/lib/slipok';
import { receiverIsShop } from '@/lib/slip-receiver';
import { MAX_ATTEMPTS, SLIP_GRACE_MS } from '@/lib/topup';

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SKEW = 60_000;
type Ctx = { params: Promise<{ id: string }> };

/**
 * อัปสลิป → ใช้โควตาตรวจสลิปของร้าน (เกิน 500/เดือน ตัดกระเป๋า SysRent ของเจ้าของร้าน ไม่พอ = ไม่ตรวจ)
 * → SlipOK → ยอดตรง + ผู้รับเป็นร้านนี้ + เวลาโอนอยู่ในช่วง QR → เงินเข้ากระเป๋า (+ จ่ายออเดอร์ต่อ ถ้า QR นี้มาจากออเดอร์)
 */
export async function POST(req: Request, { params }: Ctx) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const { id } = await params;
  if (!isUuid(id)) return fail('ไม่พบรายการ', 404);
  const d = db();
  const { data: t } = await d.from('shop_topups').select('id, amount, status, attempts, pay_order, created_at, expires_at')
    .eq('id', id).eq('shop_id', a.shop.id).eq('customer_id', a.me.id).maybeSingle();
  if (!t) return fail('ไม่พบรายการ', 404);
  if (t.status === 'paid') return fail('รายการนี้ชำระเรียบร้อยแล้ว', 409);
  if (t.status !== 'pending') return fail('รายการนี้หมดเวลาแล้ว กรุณาสร้าง QR ใหม่', 410, { expired: true });
  const created = new Date(t.created_at).getTime();
  const expires = new Date(t.expires_at).getTime();
  if (Date.now() > expires + SLIP_GRACE_MS) {
    await d.from('shop_topups').update({ status: 'expired' }).eq('id', t.id).eq('status', 'pending');
    return fail('เกินเวลาตรวจสลิป หากโอนแล้วกรุณาติดต่อร้านพร้อมสลิป', 410, { expired: true });
  }
  if (t.attempts >= MAX_ATTEMPTS) return fail('อัปสลิปเกินจำนวนครั้ง กรุณาติดต่อร้าน', 429);
  if (!slipOkConfigured()) return fail('ระบบตรวจสลิปยังไม่พร้อม กรุณาติดต่อร้าน', 503);

  const form = await req.formData().catch(() => null);
  const file = form?.get('slip');
  if (!(file instanceof Blob) || !file.size) return fail('กรุณาเลือกรูปสลิป');
  if (file.size > 5 * 1024 * 1024) return fail('ไฟล์ใหญ่เกิน 5MB');
  if (!TYPES.has(file.type)) return fail('รองรับเฉพาะรูป jpg, png, webp');

  // โควตาตรวจสลิปของร้าน (นับก่อนส่งไปตรวจ เพราะ SlipOK คิดเงินทุกครั้ง)
  const { data: allowed, error: qErr } = await d.rpc('shop_use_slip', { p_shop: a.shop.id });
  if (qErr) { console.error('[slip] quota', qErr.message); return fail('ระบบตรวจสลิปขัดข้อง กรุณาลองใหม่', 500); }
  if (!allowed) return fail('ร้านใช้โควตาตรวจสลิปเดือนนี้ครบแล้ว — ระบบยังรับเงินไม่ได้ชั่วคราว กรุณาติดต่อร้านทาง LINE', 503);

  await d.from('shop_topups').update({ attempts: t.attempts + 1 }).eq('id', t.id);
  const amount = Number(t.amount);
  const r = await checkSlip(file, 'slip.' + (file.type.split('/')[1] || 'jpg'), amount);
  const bad = async (msg: string, status = 400) => { await d.from('shop_topups').update({ last_error: msg }).eq('id', t.id); return fail(msg, status); };
  if (!r.ok) return bad(r.message, r.retryable ? 503 : 400);
  const s = r.data;
  if (Math.abs(Number(s.amount) - amount) >= 0.005) return bad(`ยอดในสลิป ฿${s.amount} ไม่ตรงกับยอดที่ต้องโอน ฿${amount}`);
  if (!receiverIsShop(s.receiver, a.shop)) return bad('บัญชีผู้รับในสลิปไม่ใช่บัญชีของร้านนี้');
  const paidAt = Date.parse(s.transTimestamp);
  if (!Number.isFinite(paidAt) || paidAt < created - SKEW) return bad('สลิปนี้โอนก่อนสร้างรายการ ใช้ไม่ได้');
  if (paidAt > expires + SKEW) return bad('โอนหลัง QR หมดอายุ กรุณาติดต่อร้านพร้อมสลิป');

  const slip = { transRef: s.transRef, at: s.transTimestamp, amount: s.amount, sender: s.sender?.displayName || s.sender?.name || null, bank: s.sendingBank ?? null };
  const { data: balance, error } = await d.rpc('shop_credit_topup', { p_topup: t.id, p_ref: s.transRef, p_slip: slip });
  if (error) {
    if (/DUPLICATE_SLIP/.test(error.message) || error.code === '23505') return bad('สลิปนี้ถูกใช้ไปแล้ว', 409);
    if (/NOT_PENDING/.test(error.message)) return fail('รายการนี้ชำระเรียบร้อยแล้ว', 409);
    console.error('[slip] credit', error.message);
    return bad('บันทึกยอดเงินไม่สำเร็จ กรุณาติดต่อร้านพร้อมสลิป', 500);
  }

  // QR นี้มาจากออเดอร์ → จ่ายต่อจากกระเป๋าทันที (ออเดอร์หมดเวลา/ของหมด = เงินยังอยู่ในกระเป๋า ไม่หาย)
  if (t.pay_order) {
    const { data: o, error: pErr } = await d.rpc('shop_pay_order', { p_order: t.pay_order, p_customer: a.me.id, p_paid_by: 'promptpay' });
    if (!pErr && o) return NextResponse.json({ ok: true, amount, order: (o as { code: string }).code });
    return NextResponse.json({ ok: true, amount, balance: Number(balance), orderError: 'เงินเข้ากระเป๋าแล้ว แต่ออเดอร์จ่ายไม่สำเร็จ (อาจหมดเวลาหรือของหมด) — สั่งใหม่แล้วจ่ายด้วยกระเป๋าได้เลย' });
  }
  return NextResponse.json({ ok: true, amount, balance: Number(balance) });
}
