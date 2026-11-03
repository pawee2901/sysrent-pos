import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';

const money = z.number().positive('ราคาต้องมากกว่า 0').max(1_000_000);
const opt = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'ใส่ชื่อแพ็กเกจ').max(60),
  price: money,
  compare_at: money.nullable().default(null),
  cost: z.number().min(0).max(1_000_000).nullable().default(null),
  duration_days: z.number().int().min(1).max(3650).nullable().default(null),
  active: z.boolean().default(true),
});
const prod = z.object({
  name: z.string().trim().min(1, 'ใส่ชื่อสินค้า').max(80),
  category: z.string().trim().max(30).default(''),
  description: z.string().max(3000).default(''),
  image: z.string().trim().max(500).refine((u) => !u || /^https:\/\//.test(u), 'ลิงก์รูปต้องเป็น https').default(''),
  template: z.string().trim().max(20).default(''),
  fulfillment: z.enum(['stock', 'slot', 'manual']),
  badge: z.string().trim().max(16).default(''),
  sort: z.number().int().min(-999).max(999).default(0),
  active: z.boolean().default(true),
  options: z.array(opt).min(1, 'ต้องมีอย่างน้อย 1 แพ็กเกจ').max(12),
});
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), id: z.string().uuid().optional(), data: prod }),
  z.object({ action: z.literal('toggle'), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
  z.object({ action: z.literal('stock'), optionId: z.string().uuid(), text: z.string().min(1).max(200_000) }),
]);

/** จัดการสินค้า + แพ็กเกจ + เพิ่มสต็อก (ทุกคำสั่งตรวจว่าเป็นของร้านนี้) */
export async function POST(req: Request) {
  const a = await requireAdmin();
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db();
  const sid = a.shop.id;
  const own = async (id: string) => (await d.from('shop_products').select('id, fulfillment').eq('id', id).eq('shop_id', sid).maybeSingle()).data;
  const x = b.data;

  if (x.action === 'save') {
    const { options, ...p } = x.data;
    let pid = x.id;
    if (pid) {
      if (!(await own(pid))) return fail('ไม่พบสินค้า', 404);
      const { error } = await d.from('shop_products').update(p).eq('id', pid);
      if (error) return fail('บันทึกไม่สำเร็จ', 500);
    } else {
      const { count } = await d.from('shop_products').select('id', { count: 'exact', head: true }).eq('shop_id', sid);
      if ((count ?? 0) >= 200) return fail('ร้านมีสินค้าได้สูงสุด 200 รายการ');
      const { data, error } = await d.from('shop_products').insert({ ...p, shop_id: sid }).select('id').single();
      if (error || !data) return fail('สร้างสินค้าไม่สำเร็จ', 500);
      pid = data.id;
    }
    // แพ็กเกจ: แก้ตัวเดิม / เพิ่มตัวใหม่ / ตัวที่หายไป = ลบ (ถ้ามีออเดอร์แล้วปิดขายแทน)
    const { data: cur } = await d.from('shop_options').select('id').eq('product_id', pid);
    const keep = new Set(options.filter((o) => o.id).map((o) => o.id!));
    for (const [i, o] of options.entries()) {
      const row = { name: o.name, price: o.price, compare_at: o.compare_at, cost: o.cost, duration_days: o.duration_days, active: o.active, sort: i };
      if (o.id && (cur ?? []).some((c) => c.id === o.id)) await d.from('shop_options').update(row).eq('id', o.id);
      else await d.from('shop_options').insert({ ...row, product_id: pid });
    }
    for (const c of cur ?? []) {
      if (keep.has(c.id)) continue;
      const { count } = await d.from('shop_order_items').select('id', { count: 'exact', head: true }).eq('option_id', c.id);
      if (count) await d.from('shop_options').update({ active: false }).eq('id', c.id);
      else await d.from('shop_options').delete().eq('id', c.id);
    }
    return NextResponse.json({ ok: true, id: pid });
  }

  if (x.action === 'toggle') {
    if (!(await own(x.id))) return fail('ไม่พบสินค้า', 404);
    await d.from('shop_products').update({ active: x.active }).eq('id', x.id);
    return NextResponse.json({ ok: true });
  }

  if (x.action === 'delete') {
    if (!(await own(x.id))) return fail('ไม่พบสินค้า', 404);
    const { count } = await d.from('shop_order_items').select('id', { count: 'exact', head: true }).eq('product_id', x.id);
    const { count: accs } = await d.from('shop_accounts').select('id', { count: 'exact', head: true }).eq('product_id', x.id);
    if (count || accs) {
      await d.from('shop_products').update({ active: false }).eq('id', x.id);
      return NextResponse.json({ ok: true, notice: 'สินค้านี้มีออเดอร์หรือบัญชีในคลังแล้ว จึงปิดขายแทนการลบ' });
    }
    await d.from('shop_products').delete().eq('id', x.id);
    return NextResponse.json({ ok: true });
  }

  // เพิ่มสต็อก: 1 บรรทัด = 1 ชิ้น · หลายบรรทัดต่อชิ้นให้คั่นด้วยบรรทัด ---
  const { data: o } = await d.from('shop_options').select('id, shop_products!inner(shop_id, fulfillment)').eq('id', x.optionId).eq('shop_products.shop_id', sid).maybeSingle();
  if (!o) return fail('ไม่พบแพ็กเกจ', 404);
  if ((o.shop_products as unknown as { fulfillment: string }).fulfillment !== 'stock') return fail('สินค้านี้ไม่ได้ใช้คลังโค้ด');
  const t = x.text.replace(/\r\n/g, '\n').trim();
  const items = [...new Set((/^\s*-{3,}\s*$/m.test(t) ? t.split(/^\s*-{3,}\s*$/m) : t.split('\n')).map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 2000)))];
  if (!items.length) return fail('ไม่มีรายการให้เพิ่ม');
  if (items.length > 2000) return fail('เพิ่มได้ครั้งละไม่เกิน 2,000 ชิ้น');
  const { error } = await d.from('shop_stock').insert(items.map((content) => ({ option_id: x.optionId, content })));
  if (error) return fail('เพิ่มสต็อกไม่สำเร็จ', 500);
  return NextResponse.json({ ok: true, notice: `เพิ่มสต็อกแล้ว ${items.length} ชิ้น` });
}
