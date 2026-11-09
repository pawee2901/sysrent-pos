import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { shopCategories } from '@/lib/categories';
import { markPlain } from '@/lib/fields';

const SHORT_PLANS = [25, 15, 7, 3];
const money = z.number().positive('ราคาต้องมากกว่า 0').max(1_000_000);
const opt = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'ใส่ชื่อแพ็กเกจ').max(60),
  price: money,
  compare_at: money.nullable().default(null),
  cost: z.number().min(0).max(1_000_000).nullable().default(null),
  duration_days: z.number().int().min(1).max(3650).nullable().default(null),
  agent_price: money.nullable().default(null), // ราคาตัวแทน (ร้าน Pro) · null = ตัวแทนซื้อราคาปกติ
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
  ask_info: z.string().trim().max(60).default(''),
  sort: z.number().int().min(-999).max(999).default(0),
  active: z.boolean().default(true),
  options: z.array(opt).min(1, 'ต้องมีอย่างน้อย 1 แพ็กเกจ').max(12),
});
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), id: z.string().uuid().optional(), data: prod }),
  z.object({ action: z.literal('toggle'), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
  // mode line = 1 บรรทัด 1 ชิ้น · block = ทั้งข้อความ 1 ชิ้น (หลายชิ้นคั่นด้วยบรรทัด ---) · repeat = เพิ่มชิ้นเดิมซ้ำ (เช่น ลิงก์เชิญทีมใช้ได้หลายคน)
  z.object({ action: z.literal('stock'), optionId: z.string().uuid(), text: z.string().min(1).max(200_000), mode: z.enum(['line', 'block']).default('line'), repeat: z.number().int().min(1).max(500).default(1), plain: z.boolean().default(false) }),
  // แบ่งจอ: เพิ่มแพ็กเกจสั้น เมื่อบัญชีเหลือวันไม่พอขายแพ็กเกจที่มี · days = วันที่บัญชีเหลือ · ไม่ส่ง plans = ขอรายการพร้อมราคาแนะนำ · ส่ง plans = บันทึกตามราคาที่แอดมินยืนยัน
  z.object({ action: z.literal('short_plans'), id: z.string().uuid(), days: z.number().int().min(1).max(3650), plans: z.array(z.object({ days: z.number().int().min(1).max(3650), price: money })).min(1).max(12).optional() }),
  z.object({ action: z.literal('usage'), id: z.string().uuid(), usage: z.string().max(3000), usage_image: z.string().trim().max(500).refine((u) => !u || /^https:\/\//.test(u), 'ลิงก์รูปต้องเป็น https').optional() }),
]);

/** จัดการสินค้า + แพ็กเกจ + เพิ่มสต็อก (ทุกคำสั่งตรวจว่าเป็นของร้านนี้) */
export async function POST(req: Request) {
  const a = await requireAdmin('products');
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
    const agentRows: { option_id: string; agent_price: number | null; price: number }[] = [];
    for (const [i, o] of options.entries()) {
      const row = { name: o.name, price: o.price, compare_at: o.compare_at, cost: o.cost, duration_days: o.duration_days, active: o.active, sort: i };
      let oid = o.id;
      if (o.id && (cur ?? []).some((c) => c.id === o.id)) await d.from('shop_options').update(row).eq('id', o.id);
      else oid = (await d.from('shop_options').insert({ ...row, product_id: pid }).select('id').single()).data?.id;
      if (oid) agentRows.push({ option_id: oid, agent_price: o.agent_price ?? null, price: o.price });
    }
    // ราคาตัวแทน: มีค่า (และถูกกว่าราคาขาย) = บันทึก · ว่าง = ลบ (ตัวแทนซื้อราคาปกติ) · ยังไม่รัน 0016 = ข้าม
    const setAp = agentRows.filter((r) => r.agent_price !== null && r.agent_price < r.price);
    const clearAp = agentRows.filter((r) => !setAp.includes(r)).map((r) => r.option_id);
    if (setAp.length) await d.from('shop_agent_prices').upsert(setAp.map((r) => ({ option_id: r.option_id, agent_price: r.agent_price })));
    if (clearAp.length) await d.from('shop_agent_prices').delete().in('option_id', clearAp);
    for (const c of cur ?? []) {
      if (keep.has(c.id)) continue;
      const { count } = await d.from('shop_order_items').select('id', { count: 'exact', head: true }).eq('option_id', c.id);
      if (count) await d.from('shop_options').update({ active: false }).eq('id', c.id);
      else await d.from('shop_options').delete().eq('id', c.id);
    }
    // หมวดใหม่ที่พิมพ์ตอนเพิ่มสินค้า → ใส่ท้ายรายการหมวดของร้านให้เอง
    if (p.category) {
      const list = await shopCategories(sid);
      if (!list.includes(p.category) && list.length < 40) await d.from('shops').update({ categories: [...list, p.category] }).eq('id', sid);
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

  if (x.action === 'short_plans') {
    const p = await own(x.id);
    if (!p) return fail('ไม่พบสินค้า', 404);
    if (p.fulfillment !== 'slot') return fail('เพิ่มแพ็กเกจสั้นอัตโนมัติได้เฉพาะสินค้าแบบแบ่งจอ');
    const { data: rows, error } = await d.from('shop_options').select('id, price, duration_days, sort, active').eq('product_id', x.id);
    if (error) return fail('บันทึกไม่สำเร็จ', 500);
    const opts = rows ?? [], len = (o: { duration_days: number | null }) => o.duration_days ?? 30; // ไม่ตั้งวัน = 30 เหมือนตอนขาย
    const base = opts.filter((o) => o.active).sort((a, b) => len(b) - len(a))[0];
    if (!base) return fail('ยังไม่มีแพ็กเกจที่เปิดขาย เพิ่มแพ็กเกจหลักที่หน้าสินค้าก่อน');

    const want = SHORT_PLANS.filter((n) => n < len(base));
    if (!want.some((n) => n <= x.days) && x.days < len(base)) want.push(x.days);
    // แพ็กเกจที่เคยปิดไว้เปิดกลับมาใช้ราคาเดิม · ที่เหลือสร้างใหม่ (ได้สูงสุด 12 แพ็กเกจเท่าหน้าสินค้า เก็บตัวสั้นไว้ก่อน)
    const missing = want.filter((n) => !opts.some((o) => len(o) === n));
    const reopen = opts.filter((o) => !o.active && want.includes(len(o)) && !opts.some((c) => c.active && len(c) === len(o)));
    const room = 12 - opts.length, fresh = room > 0 ? missing.slice(-room) : [];
    const lastSort = Math.max(0, ...opts.map((o) => o.sort));
    if (!x.plans) {
      const suggested = [...fresh.map((n) => ({ days: n, price: Math.max(1, Math.ceil((Number(base.price) * n) / len(base))) })), ...reopen.map((o) => ({ days: len(o), price: Number(o.price) }))].sort((a, b) => b.days - a.days);
      return NextResponse.json({ ok: true, plans: suggested });
    }
    // บันทึกเฉพาะแพ็กเกจที่ระบบเสนอ ด้วยราคาที่แอดมินยืนยัน
    const price = new Map(x.plans.map((o) => [o.days, o.price]));
    const rows2 = fresh.filter((n) => price.has(n)).map((n, i) => ({ product_id: x.id, name: `${n} วัน`, price: price.get(n)!, duration_days: n, sort: lastSort + i + 1, active: true }));
    const back = reopen.filter((o) => price.has(len(o)));
    for (const o of back) {
      const { error: e } = await d.from('shop_options').update({ active: true, price: price.get(len(o)) }).eq('id', o.id);
      if (e) return fail('บันทึกไม่สำเร็จ', 500);
    }
    if (rows2.length) {
      const { error: e } = await d.from('shop_options').insert(rows2);
      if (e) return fail('บันทึกไม่สำเร็จ', 500);
    }
    const added = [...rows2.map((o) => `${o.name} ฿${o.price}`), ...back.map((o) => `${len(o)} วัน ฿${price.get(len(o))}`)];
    return NextResponse.json({ ok: true, notice: added.length ? `เพิ่มแพ็กเกจแล้ว: ${added.join(' · ')}` : 'ไม่มีแพ็กเกจให้เพิ่ม' });
  }

  if (x.action === 'usage') {
    if (!(await own(x.id))) return fail('ไม่พบสินค้า', 404);
    const upd: Record<string, string> = { usage: x.usage.trim() };
    if (x.usage_image !== undefined) upd.usage_image = x.usage_image;
    const { error } = await d.from('shop_products').update(upd).eq('id', x.id);
    if (!error) return NextResponse.json({ ok: true });
    return fail(error.message.includes('usage_image') ? 'ยังไม่ได้รัน SQL 0012_usage_image.sql' : error.message.includes('usage') ? 'ยังไม่ได้รัน SQL 0011_product_usage.sql' : 'บันทึกไม่สำเร็จ', 500);
  }

  // เพิ่มสต็อก: ทีละบรรทัด (1 บรรทัด = 1 ชิ้น) หรือ 1 ชิ้นหลายบรรทัด (คั่นหลายชิ้นด้วยบรรทัด ---)
  const { data: o } = await d.from('shop_options').select('id, shop_products!inner(shop_id, fulfillment)').eq('id', x.optionId).eq('shop_products.shop_id', sid).maybeSingle();
  if (!o) return fail('ไม่พบแพ็กเกจ', 404);
  if ((o.shop_products as unknown as { fulfillment: string }).fulfillment !== 'stock') return fail('สินค้านี้ไม่ได้เป็นแบบส่งอัตโนมัติ');
  const t = x.text.replace(/\r\n/g, '\n').trim();
  const parts = x.mode === 'block' ? t.split(/^\s*-{3,}\s*$/m) : t.split('\n');
  const uniq = [...new Set(parts.map((s) => (x.mode === 'block' ? s.replace(/^\n+|\s+$/g, '') : s.trim())).filter((s) => s.trim()).map((s) => s.slice(0, 4000)))];
  const items = uniq.flatMap((c) => Array.from({ length: x.repeat ?? 1 }, () => c));
  if (!items.length) return fail('ไม่มีรายการให้เพิ่ม');
  if (items.length > 2000) return fail('เพิ่มได้ครั้งละไม่เกิน 2,000 ชิ้น');
  const { error } = await d.from('shop_stock').insert(items.map((content) => ({ option_id: x.optionId, content: x.plain ? markPlain(content) : content })));
  if (error) return fail('เพิ่มสต็อกไม่สำเร็จ', 500);
  return NextResponse.json({ ok: true, notice: `เพิ่มสต็อกแล้ว ${items.length} ชิ้น` });
}
