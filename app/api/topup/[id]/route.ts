import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, isUuid, requireCustomer } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

/** สถานะรายการเติมเงิน — หน้า QR ถามทุกไม่กี่วินาที (เงินเข้าอัตโนมัติ = เปลี่ยนหน้าเอง) */
export async function GET(_req: Request, { params }: Ctx) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const { id } = await params;
  if (!isUuid(id)) return fail('ไม่พบรายการ', 404);
  const d = db();
  const { data: t } = await d.from('shop_topups').select('status, amount, pay_order').eq('id', id).eq('shop_id', a.shop.id).eq('customer_id', a.me.id).maybeSingle();
  if (!t) return fail('ไม่พบรายการ', 404);
  if (t.status !== 'paid') return NextResponse.json({ ok: true, status: t.status });
  let order: string | undefined, orderError: string | undefined;
  if (t.pay_order) {
    const { data: o } = await d.from('shop_orders').select('code, status').eq('id', t.pay_order).maybeSingle();
    if (o && o.status !== 'pending') order = o.code;
    else orderError = 'เงินเข้ากระเป๋าแล้ว แต่ออเดอร์จ่ายไม่สำเร็จ (อาจหมดเวลาหรือของหมด) — สั่งใหม่แล้วจ่ายด้วยกระเป๋าได้เลย';
  }
  return NextResponse.json({ ok: true, status: 'paid', amount: Number(t.amount), order, orderError });
}
