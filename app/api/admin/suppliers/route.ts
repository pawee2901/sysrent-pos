import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { SUPPLIER_COLS, callSupplier, encKey, fulfillViaApi, plainKey, supplierBalance, supplierLog, type Supplier } from '@/lib/supplier';

const path = z.string().trim().max(80).regex(/^[\w.[\]-]*$/, 'ตำแหน่งใช้ได้แค่ a-z 0-9 _ . [ ]').default('');
const url = z.string().trim().max(500).default('');
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'), id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'ตั้งชื่อร้านส่ง').max(40),
    buy_url: z.string().trim().min(8, 'ใส่ URL สั่งซื้อ').max(500), method: z.enum(['POST', 'GET']), body_type: z.enum(['json', 'form']),
    headers: z.string().max(1000).default(''), body_tpl: z.string().max(2000).default(''),
    api_key: z.string().trim().max(500).default(''), clear_key: z.boolean().default(false),
    ok_path: path, ok_value: z.string().trim().max(80).default(''), account_path: path, error_path: path,
    balance_url: url, balance_path: path, active: z.boolean().default(true),
  }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
  z.object({ action: z.literal('balance'), id: z.string().uuid() }),
  z.object({ action: z.literal('test'), id: z.string().uuid(), code: z.string().trim().max(80).default(''), info: z.string().trim().max(300).default('') }),
  z.object({ action: z.literal('map'), option_id: z.string().uuid(), supplier_id: z.string().uuid().nullable(), api_code: z.string().trim().max(80).default('') }),
  z.object({ action: z.literal('retry'), item_id: z.string().uuid() }),
]);

const notReady = (m: string) => /shop_supplier|supplier_id|api_code|api_status/.test(m);

/** หลังบ้าน → เชื่อม API ร้านส่ง: บันทึก / ลบ / เช็กยอด / ทดลองซื้อ / ผูกแพ็กเกจ / ส่งใหม่ */
export async function POST(req: Request) {
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const x = b.data;
  const a = await requireAdmin(x.action === 'retry' ? 'orders' : 'products');
  if ('res' in a) return a.res;
  const d = db(), shopId = a.shop.id;
  const own = async (id: string) => (await d.from('shop_suppliers').select(SUPPLIER_COLS).eq('id', id).eq('shop_id', shopId).maybeSingle()).data as Supplier | null;

  if (x.action === 'save') {
    if (x.body_type === 'json' && x.method === 'POST' && x.body_tpl.trim()) {
      const probe = x.body_tpl.replace(/\{\{\s*\w+\s*\}\}/g, '0');
      try { JSON.parse(probe); } catch { return fail('แม่แบบข้อมูลไม่ใช่ JSON ที่ถูกต้อง (ตรวจเครื่องหมาย " , { })'); }
    }
    const row: Record<string, unknown> = {
      name: x.name, buy_url: x.buy_url, method: x.method, body_type: x.body_type, headers: x.headers.trim(), body_tpl: x.body_tpl.trim(),
      ok_path: x.ok_path, ok_value: x.ok_value, account_path: x.account_path, error_path: x.error_path, balance_url: x.balance_url, balance_path: x.balance_path, active: x.active,
    };
    if (x.api_key) row.api_key = encKey(x.api_key); else if (x.clear_key || !x.id) row.api_key = '';
    const q = x.id ? d.from('shop_suppliers').update(row).eq('id', x.id).eq('shop_id', shopId).select('id') : d.from('shop_suppliers').insert({ ...row, shop_id: shopId }).select('id');
    const { data, error } = await q;
    if (error) return fail(notReady(error.message) ? 'ยังไม่ได้รัน SQL 0057_supplier_api.sql' : 'บันทึกไม่สำเร็จ', 500);
    return data?.length ? NextResponse.json({ ok: true, id: data[0].id }) : fail('ไม่พบร้านส่ง', 404);
  }
  if (x.action === 'delete') {
    const { data } = await d.from('shop_suppliers').delete().eq('id', x.id).eq('shop_id', shopId).select('id');
    return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบร้านส่ง', 404);
  }
  if (x.action === 'balance') {
    const s = await own(x.id);
    if (!s) return fail('ไม่พบร้านส่ง', 404);
    const r = await supplierBalance(s);
    return NextResponse.json({ ok: true, result: r });
  }
  if (x.action === 'test') {
    const s = await own(x.id);
    if (!s) return fail('ไม่พบร้านส่ง', 404);
    const r = await callSupplier(s, { key: plainKey(s.api_key), code: x.code, qty: 1, order: 'TEST', info: x.info, user: 'test' });
    await supplierLog(shopId, s.id, 'test', r);
    return NextResponse.json({ ok: true, result: { ok: r.ok, http: r.http, account: r.account, message: r.message, raw: r.raw.slice(0, 3000), ms: r.ms } });
  }
  if (x.action === 'map') {
    const { data: opt } = await d.from('shop_options').select('id, shop_products!inner(shop_id)').eq('id', x.option_id).eq('shop_products.shop_id', shopId).maybeSingle();
    if (!opt) return fail('ไม่พบแพ็กเกจ', 404);
    if (x.supplier_id && !(await own(x.supplier_id))) return fail('ไม่พบร้านส่ง', 404);
    const { error } = await d.from('shop_options').update({ supplier_id: x.supplier_id, api_code: x.supplier_id ? x.api_code : '' }).eq('id', x.option_id);
    return error ? fail(notReady(error.message) ? 'ยังไม่ได้รัน SQL 0057_supplier_api.sql' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  // retry: รายการที่ส่งผ่าน API ไม่สำเร็จ → ลองซื้อใหม่
  const { data: it } = await d.from('shop_order_items').select('id, order_id, api_status, status, shop_orders!inner(shop_id)').eq('id', x.item_id).eq('shop_orders.shop_id', shopId).maybeSingle();
  if (!it) return fail('ไม่พบรายการ', 404);
  if (it.status !== 'queued') return fail('รายการนี้ส่งของ / คืนเงินไปแล้ว', 409);
  if (it.api_status === 'calling') return fail('กำลังเรียก API อยู่ รอสักครู่', 409);
  const r = await fulfillViaApi(shopId, it.order_id as string, { itemId: x.item_id, retry: it.api_status === 'fail' });
  return r.sent ? NextResponse.json({ ok: true }) : fail(r.failed[0] ?? 'แพ็กเกจนี้ยังไม่ได้ผูก API ร้านส่ง', 502);
}
