import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { hashPassword } from '@/lib/auth';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('adjust'), id: z.string().uuid(), amount: z.number().refine((n) => n !== 0 && Math.abs(n) <= 100000, 'จำนวนไม่ถูกต้อง'), note: z.string().trim().min(1).max(200) }),
  z.object({ action: z.literal('block'), id: z.string().uuid(), blocked: z.boolean() }),
  z.object({ action: z.literal('password'), id: z.string().uuid(), password: z.string().min(6, 'รหัสผ่านอย่างน้อย 6 ตัว').max(72) }),
]);

export async function POST(req: Request) {
  const a = await requireAdmin();
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), x = b.data;
  if (x.action === 'adjust') {
    const { error } = await d.rpc('shop_adjust_balance', { p_shop: a.shop.id, p_customer: x.id, p_amount: Math.round(x.amount * 100) / 100, p_note: x.note });
    if (error) return fail(/INSUFFICIENT/.test(error.message) ? 'ยอดเงินลูกค้าไม่พอให้หัก' : 'ปรับยอดไม่สำเร็จ', 400);
    return NextResponse.json({ ok: true });
  }
  const upd = x.action === 'block' ? { blocked: x.blocked } : { pass_hash: await hashPassword(x.password) };
  const { data } = await d.from('shop_customers').update(upd).eq('id', x.id).eq('shop_id', a.shop.id).select('id');
  if (!data?.length) return fail('ไม่พบลูกค้า', 404);
  // ระงับ / เปลี่ยนรหัส = ออกจากระบบทุกเครื่อง
  await d.from('shop_sessions').delete().eq('customer_id', x.id);
  return NextResponse.json({ ok: true });
}
