import { adminShop } from '@/lib/admin-page';
import { db } from '@/lib/db';
import { ReviewsClient, type AdminReview } from './ReviewsClient';

export const dynamic = 'force-dynamic';

/** หลังบ้าน → รีวิว: รีวิวทั้งหมดของร้าน · ซ่อน / ตอบกลับ */
export default async function AdminReviews({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const shop = await adminShop('reviews');
  if (!shop) return null;
  const { s = '' } = await searchParams;
  let q = db().from('shop_reviews').select('id, stars, body, reply, hidden, created_at, shop_customers(username), shop_products(name), shop_order_items(shop_orders(code))')
    .eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(300);
  if (s === 'hidden') q = q.eq('hidden', true);
  else if (/^[1-5]$/.test(s)) q = q.eq('stars', Number(s));
  const { data, error } = await q;
  type R = { id: string; stars: number; body: string; reply: string; hidden: boolean; created_at: string; shop_customers: { username: string } | null; shop_products: { name: string } | null; shop_order_items: { shop_orders: { code: string } | null } | null };
  const list: AdminReview[] = ((data ?? []) as unknown as R[]).map((r) => ({
    id: r.id, stars: r.stars, body: r.body, reply: r.reply, hidden: r.hidden, user: r.shop_customers?.username ?? '', product: r.shop_products?.name ?? '', code: r.shop_order_items?.shop_orders?.code ?? '',
    when: new Date(r.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
  }));
  return <ReviewsClient list={list} ready={!error} filter={s} />;
}
