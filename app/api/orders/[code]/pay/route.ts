import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, dbFail, fail, requireCustomer } from '@/lib/api';
import { createTopup } from '@/lib/topup';

const schema = z.object({ method: z.enum(['wallet', 'promptpay']) });
type Ctx = { params: Promise<{ code: string }> };

/** จ่ายออเดอร์: กระเป๋า = ตัดเงิน + ส่งของทันที · พร้อมเพย์ = QR ยอดเท่าออเดอร์ (อัปสลิปผ่านแล้วระบบจ่ายให้เอง) */
export async function POST(req: Request, { params }: Ctx) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const { code } = await params;
  if (!/^[A-F0-9]{8}$/.test(code)) return fail('ไม่พบออเดอร์', 404);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db();
  const { data: o } = await d.from('shop_orders').select('id, total, status, expires_at').eq('shop_id', a.shop.id).eq('code', code).eq('customer_id', a.me.id).maybeSingle();
  if (!o) return fail('ไม่พบออเดอร์', 404);
  if (o.status !== 'pending') return fail('ออเดอร์นี้ชำระเงินแล้ว', 409);
  if (new Date(o.expires_at).getTime() < Date.now()) return fail('ออเดอร์หมดเวลาชำระ (30 นาที) กรุณาสั่งใหม่', 410);

  if (b.data.method === 'wallet') {
    const { error } = await d.rpc('shop_pay_order', { p_order: o.id, p_customer: a.me.id, p_paid_by: 'wallet' });
    if (error) return dbFail(error.message);
    return NextResponse.json({ ok: true });
  }
  const t = await createTopup(a.shop, a.me.id, Number(o.total), o.id);
  if ('error' in t) return fail(t.error, t.status);
  return NextResponse.json({ ok: true, ...t });
}
