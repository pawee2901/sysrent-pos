import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { couponLimit } from '@/lib/plan';
import { body, fail, requireAdmin } from '@/lib/api';

const money = z.number().min(0).max(1_000_000);
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'โค้ดใช้ A-Z และ 0-9 ยาว 3–20 ตัว'),
    kind: z.enum(['percent', 'amount']),
    value: z.number().positive('ส่วนลดต้องมากกว่า 0').max(1_000_000),
    min_total: money.default(0),
    max_discount: money.nullable().default(null),
    max_uses: z.number().int().min(1).max(1_000_000).nullable().default(null),
    expires_at: z.string().datetime({ offset: true }).nullable().default(null),
  }),
  z.object({ action: z.literal('toggle'), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
]);

/** คูปองส่วนลดของร้าน: สร้าง / เปิด-ปิด / ลบ (ถูกใช้ไปแล้ว = ปิดแทนการลบ) */
export async function POST(req: Request) {
  const a = await requireAdmin('coupons');
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), x = b.data, sid = a.shop.id;

  if (x.action === 'create') {
    if (x.kind === 'percent' && x.value > 100) return fail('ส่วนลดแบบ % ต้องไม่เกิน 100');
    const { count } = await d.from('shop_coupons').select('id', { count: 'exact', head: true }).eq('shop_id', sid);
    const lim = couponLimit(a.shop.plan);
    if (lim !== null && (count ?? 0) >= lim) return fail(`แพ็กเกจนี้มีคูปองได้ ${lim} โค้ด · อัปเกรดเป็น Pro เพื่อสร้างได้ไม่จำกัด`, 403);
    if ((count ?? 0) >= 200) return fail('ร้านมีคูปองได้สูงสุด 200 โค้ด');
    const { action: _a, ...row } = x;
    const { error } = await d.from('shop_coupons').insert({ ...row, max_discount: row.kind === 'percent' ? row.max_discount : null, shop_id: sid });
    if (error) return fail(error.code === '23505' ? 'มีโค้ดนี้อยู่แล้ว' : 'สร้างคูปองไม่สำเร็จ', error.code === '23505' ? 409 : 500);
    return NextResponse.json({ ok: true });
  }
  if (x.action === 'toggle') {
    const { data } = await d.from('shop_coupons').update({ active: x.active }).eq('id', x.id).eq('shop_id', sid).select('id');
    return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบคูปอง', 404);
  }
  const { data: c } = await d.from('shop_coupons').select('used').eq('id', x.id).eq('shop_id', sid).maybeSingle();
  if (!c) return fail('ไม่พบคูปอง', 404);
  const { count } = await d.from('shop_orders').select('id', { count: 'exact', head: true }).eq('coupon_id', x.id);
  if (c.used > 0 || count) {
    await d.from('shop_coupons').update({ active: false }).eq('id', x.id);
    return NextResponse.json({ ok: true, notice: 'คูปองนี้มีออเดอร์ใช้แล้ว จึงปิดใช้งานแทนการลบ' });
  }
  await d.from('shop_coupons').delete().eq('id', x.id);
  return NextResponse.json({ ok: true });
}
