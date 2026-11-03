import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { decrypt, encConfigured, encrypt } from '@/lib/secret';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), productId: z.string().uuid(), login: z.string().trim().min(3, 'ใส่อีเมลบัญชี').max(120), password: z.string().min(1, 'ใส่รหัสผ่าน').max(200),
    cost: z.number().min(0).max(100000).nullable(), renew_at: date, slots: z.array(z.object({ label: z.string().trim().min(1).max(40), pin: z.string().trim().max(12) })).min(1).max(20) }),
  z.object({ action: z.literal('edit'), id: z.string().uuid(), login: z.string().trim().min(3).max(120), password: z.string().max(200), cost: z.number().min(0).max(100000).nullable(), renew_at: date }),
  z.object({ action: z.literal('status'), id: z.string().uuid(), status: z.enum(['active', 'broken', 'retired']) }),
  z.object({ action: z.literal('reveal'), id: z.string().uuid() }),
  z.object({ action: z.literal('slot'), slotId: z.string().uuid(), label: z.string().trim().min(1).max(40), pin: z.string().trim().max(12), status: z.enum(['free', 'broken']).optional() }),
]);

/** คลังบัญชีหลัก: เพิ่มบัญชี + จอ · แก้ไข · ดูรหัส · เปลี่ยน PIN แล้วพร้อมขาย (ทุกคำสั่งตรวจว่าเป็นของร้านนี้) */
export async function POST(req: Request) {
  const a = await requireAdmin();
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), sid = a.shop.id, x = b.data;
  const own = async (id: string) => (await d.from('shop_accounts').select('id, secret_enc').eq('id', id).eq('shop_id', sid).maybeSingle()).data;

  if (x.action === 'add') {
    if (!encConfigured()) return fail('ระบบยังไม่ได้ตั้งกุญแจเข้ารหัส กรุณาติดต่อ SysRent', 503);
    const { data: p } = await d.from('shop_products').select('fulfillment').eq('id', x.productId).eq('shop_id', sid).maybeSingle();
    if (!p) return fail('ไม่พบสินค้า', 404);
    if (p.fulfillment !== 'slot') return fail('สินค้านี้ไม่ได้ตั้งเป็นแบบแบ่งจอ');
    const { data: acc, error } = await d.from('shop_accounts').insert({ shop_id: sid, product_id: x.productId, login: x.login, secret_enc: encrypt(x.password), cost: x.cost, renew_at: x.renew_at }).select('id').single();
    if (error || !acc) return fail('เพิ่มบัญชีไม่สำเร็จ', 500);
    await d.from('shop_slots').insert(x.slots.map((s, i) => ({ account_id: acc.id, label: s.label, pin: s.pin, sort: i })));
    return NextResponse.json({ ok: true });
  }
  if (x.action === 'edit') {
    if (!(await own(x.id))) return fail('ไม่พบบัญชี', 404);
    const upd: Record<string, unknown> = { login: x.login, cost: x.cost, renew_at: x.renew_at };
    if (x.password) upd.secret_enc = encrypt(x.password);
    await d.from('shop_accounts').update(upd).eq('id', x.id);
    return NextResponse.json({ ok: true });
  }
  if (x.action === 'status') {
    if (!(await own(x.id))) return fail('ไม่พบบัญชี', 404);
    await d.from('shop_accounts').update({ status: x.status }).eq('id', x.id);
    return NextResponse.json({ ok: true });
  }
  if (x.action === 'reveal') {
    const acc = await own(x.id);
    if (!acc) return fail('ไม่พบบัญชี', 404);
    try { return NextResponse.json({ ok: true, password: decrypt(acc.secret_enc) }, { headers: { 'Cache-Control': 'no-store' } }); }
    catch { return fail('ถอดรหัสไม่ได้ กรุณาตั้งรหัสใหม่', 500); }
  }
  // จอ: แก้ชื่อ/PIN · รอเปลี่ยน PIN → พร้อมขาย · ตั้งเสีย (จอที่มีคนเช่าเปลี่ยนสถานะไม่ได้)
  const { data: slot } = await d.from('shop_slots').select('id, status, shop_accounts!inner(shop_id)').eq('id', x.slotId).eq('shop_accounts.shop_id', sid).maybeSingle();
  if (!slot) return fail('ไม่พบจอ', 404);
  if (x.status && slot.status === 'used') return fail('จอนี้มีลูกค้าเช่าอยู่ เปลี่ยนสถานะไม่ได้', 409);
  await d.from('shop_slots').update({ label: x.label, pin: x.pin, ...(x.status ? { status: x.status } : {}) }).eq('id', x.slotId);
  return NextResponse.json({ ok: true });
}
