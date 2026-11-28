import { adminShop } from '@/lib/admin-page';
import { loadProducts } from '@/lib/catalog';
import { can } from '@/lib/plan';
import { db } from '@/lib/db';
import type { DForm } from '../products/DeliveryForm';
import { StockClient } from './StockClient';

export const dynamic = 'force-dynamic';

/** หลังบ้าน → สินค้า → สต็อก: ทุกแพ็กเกจที่ส่งอัตโนมัติ · เหลือเท่าไหร่ · เติม / ดู / ลบ */
export default async function AdminStock() {
  const shop = await adminShop('products');
  if (!shop) return null;
  const products = (await loadProducts(shop.id, { includeHidden: true })).filter((p) => p.fulfillment === 'stock');
  const ids = products.flatMap((p) => p.options.map((o) => o.id));
  const otpOn = can(shop.plan, 'otp');
  const [fq, apps, picks] = await Promise.all([
    ids.length ? db().from('shop_options').select('id, delivery_form').in('id', ids) : Promise.resolve({ data: [], error: null }),
    otpOn ? db().from('shop_otp_apps').select('id, name').eq('shop_id', shop.id).order('sort').order('created_at') : Promise.resolve(null),
    otpOn ? db().from('shop_products').select('id, otp_app_id').eq('shop_id', shop.id) : Promise.resolve(null),
  ]);
  const forms = Object.fromEntries(((fq.data ?? []) as { id: string; delivery_form: DForm | null }[]).filter((r) => r.delivery_form?.tpl).map((r) => [r.id, r.delivery_form as DForm]));
  const otp = otpOn ? {
    ready: !picks?.error, apps: (apps?.data ?? []) as { id: string; name: string }[],
    picks: Object.fromEntries(((picks?.data ?? []) as { id: string; otp_app_id: string | null }[]).filter((r) => r.otp_app_id).map((r) => [r.id, r.otp_app_id as string])),
  } : null;
  const list = products.map((p) => ({
    id: p.id, name: p.name, category: p.category, image: p.image, template: p.template, active: p.active, preorder: p.preorder,
    options: p.options.map((o) => ({ id: o.id, name: o.name, days: o.durationDays?.toString() ?? '', stock: o.stock ?? 0, price: o.price, active: o.active })),
  }));
  return <StockClient products={list} forms={forms} otp={otp} />;
}
