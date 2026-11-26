/* =============================================================
   รีวิวจากผู้ซื้อจริง (shop_reviews · SQL 0042) — ฝั่งเซิร์ฟเวอร์
   ยังไม่รัน SQL = ทุกฟังก์ชันคืนค่าว่าง (หน้าร้านไม่พัง)
   ============================================================= */
import 'server-only';
import { db } from '@/lib/db';

export type Review = { id: string; stars: number; body: string; reply: string; who: string; product: string; productId: string; when: string };
export type Rating = { avg: number; count: number };

/** ชื่อลูกค้าแบบปิดบางส่วน: somchai → s•••••i */
export const maskName = (u: string) => (!u ? 'ลูกค้า' : u.length <= 2 ? `${u[0]}•` : `${u[0]}${'•'.repeat(Math.min(6, u.length - 2))}${u[u.length - 1]}`);
const thDate = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' });

type Row = { id: string; stars: number; body: string; reply: string; created_at: string; product_id: string; shop_customers: { username: string } | null; shop_products: { name: string } | null };
const toReview = (r: Row): Review => ({ id: r.id, stars: r.stars, body: r.body, reply: r.reply, who: maskName(r.shop_customers?.username ?? ''), product: r.shop_products?.name ?? '', productId: r.product_id, when: thDate(r.created_at) });
const COLS = 'id, stars, body, reply, created_at, product_id, shop_customers(username), shop_products(name)';

/** คะแนนเฉลี่ยต่อสินค้า (การ์ดสินค้า / หน้าสินค้า) */
export async function ratings(productIds: string[]): Promise<Map<string, Rating>> {
  const out = new Map<string, Rating>();
  if (!productIds.length) return out;
  const { data, error } = await db().from('shop_reviews').select('product_id, stars').in('product_id', productIds).eq('hidden', false).limit(20000);
  if (error) return out;
  const sum = new Map<string, [number, number]>();
  for (const r of data ?? []) { const s = sum.get(r.product_id) ?? [0, 0]; sum.set(r.product_id, [s[0] + Number(r.stars), s[1] + 1]); }
  for (const [k, [t, n]] of sum) out.set(k, { avg: Math.round((t / n) * 10) / 10, count: n });
  return out;
}

/** รีวิวของสินค้า 1 ชิ้น + จำนวนแต่ละดาว */
export async function productReviews(productId: string, limit = 30): Promise<{ list: Review[]; dist: number[] }> {
  const d = db();
  const [{ data, error }, { data: all }] = await Promise.all([
    d.from('shop_reviews').select(COLS).eq('product_id', productId).eq('hidden', false).order('created_at', { ascending: false }).limit(limit),
    d.from('shop_reviews').select('stars').eq('product_id', productId).eq('hidden', false).limit(20000),
  ]);
  if (error) return { list: [], dist: [0, 0, 0, 0, 0] };
  const dist = [0, 0, 0, 0, 0];
  for (const r of all ?? []) dist[Number(r.stars) - 1]++;
  return { list: ((data ?? []) as unknown as Row[]).map(toReview), dist };
}

/** รีวิวล่าสุดของร้าน (กล่อง "รีวิวจากผู้ซื้อจริง") */
export async function latestReviews(shopId: string, limit = 6, minStars = 1, productId?: string): Promise<{ list: Review[]; rating: Rating | null }> {
  const d = db();
  let q = d.from('shop_reviews').select(COLS).eq('shop_id', shopId).eq('hidden', false).gte('stars', minStars).order('created_at', { ascending: false }).limit(limit);
  if (productId) q = q.eq('product_id', productId);
  let s = d.from('shop_reviews').select('stars').eq('shop_id', shopId).eq('hidden', false).limit(20000);
  if (productId) s = s.eq('product_id', productId);
  const [{ data, error }, { data: all }] = await Promise.all([q, s]);
  if (error) return { list: [], rating: null };
  const n = (all ?? []).length;
  return { list: ((data ?? []) as unknown as Row[]).map(toReview), rating: n ? { avg: Math.round(((all ?? []).reduce((t, r) => t + Number(r.stars), 0) / n) * 10) / 10, count: n } : null };
}
