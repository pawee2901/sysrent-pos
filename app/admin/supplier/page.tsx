import { adminShop, when } from '@/lib/admin-page';
import { db } from '@/lib/db';
import { SupplierClient, type SupplierRow, type MapRow, type LogRow } from './SupplierClient';

export const dynamic = 'force-dynamic';

/** หลังบ้าน → สินค้า → API ร้านส่ง: ตั้งร้านส่ง · ผูกแพ็กเกจ · ประวัติการเรียก */
export default async function AdminSupplier() {
  const shop = await adminShop('products');
  if (!shop) return null;
  const d = db();
  const sq = await d.from('shop_suppliers').select('id, name, buy_url, method, body_type, headers, body_tpl, api_key, ok_path, ok_value, account_path, error_path, balance_url, balance_path, active')
    .eq('shop_id', shop.id).order('created_at');
  const ready = !sq.error;
  const suppliers: SupplierRow[] = ((sq.data ?? []) as (Omit<SupplierRow, 'hasKey'> & { api_key: string })[]).map(({ api_key, ...s }) => ({ ...s, hasKey: !!api_key }));

  // แพ็กเกจของสินค้าแบบสั่งทำ (ส่งผ่าน API ได้)
  const pq = await d.from('shop_products').select('id, name, image, template, active, fulfillment').eq('shop_id', shop.id).eq('fulfillment', 'manual').order('sort');
  const prods = (pq.data ?? []) as { id: string; name: string; image: string; template: string; active: boolean }[];
  const oq = prods.length && ready
    ? await d.from('shop_options').select('id, product_id, name, price, cost, active, supplier_id, api_code').in('product_id', prods.map((p) => p.id)).order('sort')
    : { data: [] };
  const opts = (oq.data ?? []) as { id: string; product_id: string; name: string; price: number; cost: number | null; active: boolean; supplier_id: string | null; api_code: string }[];
  const maps: MapRow[] = prods.map((p) => ({
    id: p.id, name: p.name, image: p.image, template: p.template, active: p.active,
    options: opts.filter((o) => o.product_id === p.id).map((o) => ({ id: o.id, name: o.name, price: Number(o.price), cost: o.cost === null ? null : Number(o.cost), active: o.active, supplier: o.supplier_id, code: o.api_code })),
  }));

  const lq = ready ? await d.from('shop_supplier_logs').select('id, supplier_id, kind, ok, http, note, response, ms, created_at').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(60) : { data: [] };
  const logs: LogRow[] = ((lq.data ?? []) as { id: string; supplier_id: string | null; kind: string; ok: boolean; http: number | null; note: string; response: string; ms: number | null; created_at: string }[])
    .map((l) => ({ id: l.id, supplier: suppliers.find((s) => s.id === l.supplier_id)?.name ?? '—', kind: l.kind, ok: l.ok, http: l.http, note: l.note, response: l.response, ms: l.ms ?? 0, when: when(l.created_at) }));

  // รายการที่ส่งผ่าน API ไม่สำเร็จ (รอแอดมินกดส่งใหม่ / ส่งเอง)
  const fq = ready ? await d.from('shop_order_items').select('id, name, api_note, updated_at, shop_orders!inner(code, shop_id)').eq('shop_orders.shop_id', shop.id).eq('status', 'queued').eq('api_status', 'fail').order('updated_at', { ascending: false }).limit(30) : { data: [] };
  const failed = ((fq.data ?? []) as unknown as { id: string; name: string; api_note: string | null; updated_at: string; shop_orders: { code: string } }[])
    .map((f) => ({ id: f.id, name: f.name, note: f.api_note ?? '', code: f.shop_orders.code, when: when(f.updated_at) }));

  return <SupplierClient ready={ready} suppliers={suppliers} maps={maps} logs={logs} failed={failed} />;
}
