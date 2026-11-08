import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { can } from '@/lib/plan';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), username: z.string().trim().toLowerCase().min(1, 'ใส่ชื่อผู้ใช้ของลูกค้า').max(40), name: z.string().trim().max(60).default('') }),
  z.object({ action: z.literal('toggle'), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal('remove'), id: z.string().uuid() }),
]);

/** ตัวแทน (ซื้อราคาส่ง · ร้าน Pro): ตั้งลูกค้าเป็นตัวแทน · พักสิทธิ์ · เอาออก */
export async function POST(req: Request) {
  const a = await requireAdmin('agents');
  if ('res' in a) return a.res;
  if (!can(a.shop.plan, 'agents')) return fail('ระบบตัวแทนเป็นฟีเจอร์ของแพ็กเกจ Pro', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), sid = a.shop.id, x = b.data;

  if (x.action === 'add') {
    const u = x.username.replace(/^@/, '');
    const { data: c } = await d.from('shop_customers').select('id, username').eq('shop_id', sid).eq('username', u).maybeSingle();
    if (!c) return fail(`ไม่พบลูกค้า @${u} ในร้าน (ลูกค้าต้องสมัครสมาชิกก่อน)`, 404);
    const { count } = await d.from('shop_agents').select('id', { count: 'exact', head: true }).eq('shop_id', sid);
    if ((count ?? 0) >= 500) return fail('มีตัวแทนได้สูงสุด 500 คน');
    // โค้ดตัวแทน = ชื่อผู้ใช้ตัวพิมพ์ใหญ่ (ซ้ำ = ต่อท้ายตัวเลข)
    const base = (c.username.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'AGENT').slice(0, 16).padEnd(3, '0');
    for (let n = 0; n < 5; n++) {
      const code = n ? `${base}${Math.floor(Math.random() * 900 + 100)}` : base;
      const { error } = await d.from('shop_agents').insert({ shop_id: sid, customer_id: c.id, code, name: x.name });
      if (!error) return NextResponse.json({ ok: true });
      if (error.code === '23505' && /customer/.test(error.message)) return fail(`@${u} เป็นตัวแทนอยู่แล้ว`, 409);
      if (error.code !== '23505') return fail(/shop_agents/.test(error.message) ? 'ยังไม่ได้รัน SQL 0016_agents.sql' : 'เพิ่มตัวแทนไม่สำเร็จ', 500);
    }
    return fail('เพิ่มตัวแทนไม่สำเร็จ กรุณาลองใหม่', 500);
  }
  if (x.action === 'toggle') {
    const { data } = await d.from('shop_agents').update({ active: x.active }).eq('id', x.id).eq('shop_id', sid).select('id');
    return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบตัวแทน', 404);
  }
  const { data } = await d.from('shop_agents').delete().eq('id', x.id).eq('shop_id', sid).select('id');
  return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบตัวแทน', 404);
}
