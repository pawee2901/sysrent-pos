import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { adminKind, hashPassword } from '@/lib/auth';
import { can } from '@/lib/plan';
import { cleanPerms } from '@/lib/perms';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('adjust'), id: z.string().uuid(), amount: z.number().refine((n) => n !== 0 && Math.abs(n) <= 100000, 'จำนวนไม่ถูกต้อง'), note: z.string().trim().min(1).max(200) }),
  z.object({ action: z.literal('block'), id: z.string().uuid(), blocked: z.boolean() }),
  z.object({ action: z.literal('password'), id: z.string().uuid(), password: z.string().min(6, 'รหัสผ่านอย่างน้อย 6 ตัว').max(72) }),
  // ยศ: ลูกค้าทั่วไป · ตัวแทน (ร้าน Pro) · แอดมิน (เข้าหลังบ้านได้ · ตั้ง/ถอดได้เฉพาะเจ้าของร้าน)
  z.object({ action: z.literal('role'), id: z.string().uuid(), role: z.enum(['customer', 'agent', 'admin']), perms: z.array(z.string()).max(20).optional() }),
  // แก้สิทธิ์ของแอดมิน (เจ้าของร้านเท่านั้น)
  z.object({ action: z.literal('perms'), id: z.string().uuid(), perms: z.array(z.string()).max(20) }),
]);

export async function POST(req: Request) {
  const a = await requireAdmin('customers');
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), x = b.data;
  if (x.action === 'adjust') {
    const { error } = await d.rpc('shop_adjust_balance', { p_shop: a.shop.id, p_customer: x.id, p_amount: Math.round(x.amount * 100) / 100, p_note: x.note });
    if (error) return fail(/INSUFFICIENT/.test(error.message) ? 'ยอดเงินลูกค้าไม่พอให้หัก' : 'ปรับยอดไม่สำเร็จ', 400);
    return NextResponse.json({ ok: true });
  }
  if (x.action === 'perms') {
    if ((await adminKind()) !== 'owner') return fail('แก้สิทธิ์แอดมินได้เฉพาะเจ้าของร้าน', 403);
    const perms = cleanPerms(x.perms);
    if (!perms.length) return fail('เลือกอย่างน้อย 1 เมนู');
    const { data, error } = await d.from('shop_customers').update({ admin_perms: perms }).eq('id', x.id).eq('shop_id', a.shop.id).eq('role', 'admin').select('id');
    if (error) return fail(/admin_perms/.test(error.message) ? 'ยังไม่ได้รัน SQL 0018_admin_perms.sql' : 'บันทึกไม่สำเร็จ', 500);
    return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบแอดมินคนนี้', 404);
  }
  if (x.action === 'role') {
    const { data: c, error: e0 } = await d.from('shop_customers').select('id, username, role').eq('id', x.id).eq('shop_id', a.shop.id).maybeSingle();
    if (e0) return fail(/role/.test(e0.message) ? 'ยังไม่ได้รัน SQL 0017_customer_roles.sql' : 'ไม่พบลูกค้า', 500);
    if (!c) return fail('ไม่พบลูกค้า', 404);
    const owner = (await adminKind()) === 'owner';
    if ((x.role === 'admin' || c.role === 'admin') && !owner) return fail('ตั้ง / ถอดยศแอดมินได้เฉพาะเจ้าของร้าน', 403);
    if (x.role === 'admin' && !can(a.shop.plan, 'staff')) return fail('แอดมินพนักงานอยู่ในแพ็กเกจ Max', 403);
    if (x.role === 'agent' && !can(a.shop.plan, 'agents')) return fail('ยศตัวแทนเป็นฟีเจอร์ของแพ็กเกจ Pro', 403);
    let perms: string[] = [];
    if (x.role === 'admin') { perms = cleanPerms(x.perms ?? []); if (!perms.length) return fail('เลือกเมนูที่แอดมินเข้าได้อย่างน้อย 1 เมนู'); }
    const upd: Record<string, unknown> = { role: x.role === 'admin' ? 'admin' : 'customer' };
    if (x.role === 'admin') upd.admin_perms = perms;
    let { error: e1 } = await d.from('shop_customers').update(upd).eq('id', c.id);
    if (e1 && /admin_perms/.test(e1.message)) ({ error: e1 } = await d.from('shop_customers').update({ role: upd.role }).eq('id', c.id)); // ยังไม่รัน 0018 = ใช้สิทธิ์เริ่มต้น
    if (e1) return fail('บันทึกยศไม่สำเร็จ', 500);
    if (x.role === 'agent') {
      const { data: ex } = await d.from('shop_agents').select('id').eq('shop_id', a.shop.id).eq('customer_id', c.id).maybeSingle();
      if (ex) await d.from('shop_agents').update({ active: true }).eq('id', ex.id);
      else {
        const base = (c.username.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'AGENT').slice(0, 16).padEnd(3, '0');
        let ok = false;
        for (let n = 0; n < 5 && !ok; n++) {
          const { error } = await d.from('shop_agents').insert({ shop_id: a.shop.id, customer_id: c.id, code: n ? `${base}${Math.floor(Math.random() * 900 + 100)}` : base });
          if (!error) ok = true; else if (error.code !== '23505') return fail(/shop_agents/.test(error.message) ? 'ยังไม่ได้รัน SQL 0016_agents.sql' : 'ตั้งตัวแทนไม่สำเร็จ', 500);
        }
        if (!ok) return fail('ตั้งตัวแทนไม่สำเร็จ กรุณาลองใหม่', 500);
      }
    } else {
      await d.from('shop_agents').delete().eq('shop_id', a.shop.id).eq('customer_id', c.id); // ไม่ใช่ตัวแทนแล้ว (ประวัติออเดอร์ยังอยู่)
    }
    return NextResponse.json({ ok: true });
  }
  const upd = x.action === 'block' ? { blocked: x.blocked } : { pass_hash: await hashPassword(x.password) };
  const { data } = await d.from('shop_customers').update(upd).eq('id', x.id).eq('shop_id', a.shop.id).select('id');
  if (!data?.length) return fail('ไม่พบลูกค้า', 404);
  // ระงับ / เปลี่ยนรหัส = ออกจากระบบทุกเครื่อง
  await d.from('shop_sessions').delete().eq('customer_id', x.id);
  return NextResponse.json({ ok: true });
}
