import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';

const money = z.number().positive('จำนวนเงินต้องมากกว่า 0').max(10_000_000, 'จำนวนเงินมากเกินไป');
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('entry'), id: z.string().uuid().optional(), kind: z.enum(['in', 'out', 'transfer']),
    on_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ไม่ถูกต้อง'), amount: money,
    category: z.string().trim().max(40).default(''), note: z.string().trim().max(200).default(''), ref: z.string().trim().max(40).default(''),
    account_id: z.string().uuid().nullable().default(null), to_account: z.string().uuid().nullable().default(null),
  }),
  z.object({ action: z.literal('delete_entry'), id: z.string().uuid() }),
  z.object({
    action: z.literal('account'), id: z.string().uuid().optional(), name: z.string().trim().min(1, 'ตั้งชื่อบัญชี').max(40),
    kind: z.enum(['bank', 'cash', 'wallet', 'other']), number: z.string().trim().max(40).default(''),
    opening: z.number().min(-10_000_000).max(100_000_000).default(0), is_sales: z.boolean().default(false), active: z.boolean().default(true),
  }),
  z.object({ action: z.literal('delete_account'), id: z.string().uuid() }),
]);
const notReady = (m: string) => /shop_ledger|shop_money_accounts/.test(m);
const NOT_READY = 'ยังไม่ได้รัน SQL 0058_ledger.sql';

/** สมุดบัญชี: จด / แก้ / ลบรายการ (รายรับ · รายจ่าย · โอน) · เพิ่ม / แก้ / ลบบัญชีเงิน */
export async function POST(req: Request) {
  const a = await requireAdmin('accounting');
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), shopId = a.shop.id, x = b.data;

  if (x.action === 'entry') {
    if (x.kind === 'transfer') {
      if (!x.account_id || !x.to_account) return fail('เลือกบัญชีต้นทางและปลายทาง');
      if (x.account_id === x.to_account) return fail('บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน');
    } else if (!x.category) return fail('เลือกหมวด');
    const ids = [x.account_id, x.to_account].filter(Boolean) as string[];
    if (ids.length) {
      const { data } = await d.from('shop_money_accounts').select('id').eq('shop_id', shopId).in('id', ids);
      if ((data?.length ?? 0) !== new Set(ids).size) return fail('ไม่พบบัญชีเงิน', 404);
    }
    const row = {
      kind: x.kind, on_date: x.on_date, amount: Math.round(x.amount * 100) / 100, category: x.kind === 'transfer' ? 'โอนระหว่างบัญชี' : x.category,
      note: x.note, ref: x.ref, account_id: x.account_id, to_account: x.kind === 'transfer' ? x.to_account : null,
    };
    const q = x.id ? d.from('shop_ledger').update(row).eq('id', x.id).eq('shop_id', shopId).select('id') : d.from('shop_ledger').insert({ ...row, shop_id: shopId }).select('id');
    const { data, error } = await q;
    if (error) return fail(notReady(error.message) ? NOT_READY : 'บันทึกไม่สำเร็จ', 500);
    return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบรายการ', 404);
  }
  if (x.action === 'delete_entry') {
    const { data, error } = await d.from('shop_ledger').delete().eq('id', x.id).eq('shop_id', shopId).select('id');
    await d.from('shop_expenses').delete().eq('id', x.id).eq('shop_id', shopId).then(() => {}, () => {}); // รายจ่ายเดิมที่ย้ายมา (id เดียวกัน)
    if (error) return fail(notReady(error.message) ? NOT_READY : 'ลบไม่สำเร็จ', 500);
    return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบรายการ', 404);
  }
  if (x.action === 'account') {
    const row = { name: x.name, kind: x.kind, number: x.number, opening: Math.round(x.opening * 100) / 100, is_sales: x.is_sales, active: x.active };
    // บัญชีรับเงินขายมีได้บัญชีเดียว
    if (x.is_sales) await d.from('shop_money_accounts').update({ is_sales: false }).eq('shop_id', shopId).neq('id', x.id ?? '00000000-0000-0000-0000-000000000000');
    const q = x.id ? d.from('shop_money_accounts').update(row).eq('id', x.id).eq('shop_id', shopId).select('id') : d.from('shop_money_accounts').insert({ ...row, shop_id: shopId }).select('id');
    const { data, error } = await q;
    if (error) return fail(notReady(error.message) ? NOT_READY : 'บันทึกไม่สำเร็จ', 500);
    return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบบัญชี', 404);
  }
  const { data } = await d.from('shop_money_accounts').delete().eq('id', x.id).eq('shop_id', shopId).select('id');
  return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบบัญชี', 404);
}
