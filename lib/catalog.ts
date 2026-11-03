import 'server-only';
import { db } from '@/lib/db';

export type Option = { id: string; name: string; price: number; compareAt: number | null; cost: number | null; durationDays: number | null; active: boolean; stock: number | null };
export type Product = {
  id: string; name: string; category: string; description: string; image: string; template: string; badge: string;
  fulfillment: 'stock' | 'slot' | 'manual'; options: Option[]; from: number | null; left: number | null; inStock: boolean; sold: number; active: boolean; sort: number;
};

type Row = {
  id: string; name: string; category: string; description: string; image: string; template: string; badge: string;
  fulfillment: Product['fulfillment']; sort: number; active: boolean;
  shop_options: { id: string; name: string; price: number; compare_at: number | null; cost: number | null; duration_days: number | null; sort: number; active: boolean }[];
};

/** สินค้าที่เปิดขายของร้าน + สต็อก (คลัง = โค้ดที่เหลือ · จอ = จอว่าง · สั่งทำ = ไม่จำกัด) */
export async function loadProducts(shopId: string, opts: { id?: string; includeHidden?: boolean } = {}): Promise<Product[]> {
  const d = db();
  let q = d.from('shop_products').select('id, name, category, description, image, template, badge, fulfillment, sort, active, shop_options(id, name, price, compare_at, cost, duration_days, sort, active)')
    .eq('shop_id', shopId).order('sort').order('created_at');
  if (!opts.includeHidden) q = q.eq('active', true);
  if (opts.id) q = q.eq('id', opts.id);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const optionIds = rows.flatMap((r) => r.shop_options.map((o) => o.id));
  const productIds = rows.map((r) => r.id);
  const [stock, slots, sold] = await Promise.all([
    optionIds.length ? d.from('shop_option_stock').select('option_id, available').in('option_id', optionIds) : Promise.resolve({ data: [] }),
    productIds.length ? d.from('shop_free_slots').select('product_id, free').in('product_id', productIds) : Promise.resolve({ data: [] }),
    productIds.length ? d.from('shop_order_items').select('product_id, qty').in('product_id', productIds).eq('status', 'delivered').limit(20000) : Promise.resolve({ data: [] }),
  ]);
  const avail = new Map((stock.data ?? []).map((s) => [s.option_id as string, Number(s.available)]));
  const free = new Map((slots.data ?? []).map((s) => [s.product_id as string, Number(s.free)]));
  const soldBy = new Map<string, number>();
  for (const s of sold.data ?? []) soldBy.set(s.product_id as string, (soldBy.get(s.product_id as string) ?? 0) + Number(s.qty));

  return rows.map((r) => {
    const options = r.shop_options.filter((o) => o.active || opts.includeHidden).sort((a, b) => a.sort - b.sort || a.price - b.price).map((o) => ({
      id: o.id, name: o.name, price: Number(o.price), compareAt: o.compare_at === null ? null : Number(o.compare_at), cost: o.cost === null ? null : Number(o.cost), durationDays: o.duration_days, active: o.active,
      stock: r.fulfillment === 'stock' ? avail.get(o.id) ?? 0 : r.fulfillment === 'slot' ? free.get(r.id) ?? 0 : null,
    }));
    const live = options.filter((o) => o.active);
    const left = r.fulfillment === 'stock' ? options.reduce((s, o) => s + (o.stock ?? 0), 0) : r.fulfillment === 'slot' ? free.get(r.id) ?? 0 : null;
    return {
      id: r.id, name: r.name, category: r.category, description: r.description, image: r.image, template: r.template, badge: r.badge, fulfillment: r.fulfillment,
      options, from: live.length ? Math.min(...live.map((o) => o.price)) : null, left,
      inStock: live.length > 0 && (left === null || left > 0), sold: soldBy.get(r.id) ?? 0, active: r.active, sort: r.sort,
    };
  });
}
