import { db } from '@/lib/db';
import { adminShop } from '@/lib/admin-page';
import { CouponsClient, type Coupon } from './CouponsClient';

export default async function AdminCoupons() {
  const shop = await adminShop('coupons');
  if (!shop) return null;
  const d = db();
  const [{ data }, { data: orders }] = await Promise.all([
    d.from('shop_coupons').select('id, code, kind, value, min_total, max_discount, max_uses, used, expires_at, active').eq('shop_id', shop.id).order('created_at', { ascending: false }),
    d.from('shop_orders').select('coupon_id, discount').eq('shop_id', shop.id).not('coupon_id', 'is', null).not('paid_at', 'is', null).limit(20000),
  ]);
  const given = new Map<string, number>();
  for (const o of orders ?? []) given.set(o.coupon_id as string, (given.get(o.coupon_id as string) ?? 0) + Number(o.discount));
  const rows: Coupon[] = (data ?? []).map((c) => ({
    id: c.id, code: c.code, kind: c.kind, value: Number(c.value), minTotal: Number(c.min_total), maxDiscount: c.max_discount === null ? null : Number(c.max_discount),
    maxUses: c.max_uses, used: c.used, expiresAt: c.expires_at, active: c.active, given: given.get(c.id) ?? 0,
  }));
  return <CouponsClient rows={rows} />;
}
