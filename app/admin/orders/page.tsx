import { to } from '@/lib/routes';
import Link from 'next/link';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { adminShop, when } from '@/lib/admin-page';
import { OrdersTable, type AdminOrder } from './OrdersTable';

const TABS: [string, string][] = [['', 'ทั้งหมด'], ['queued', 'รอส่ง'], ['completed', 'สำเร็จ'], ['pending', 'รอชำระ'], ['refunded', 'คืนเงิน']];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ s?: string; q?: string }> }) {
  const shop = await adminShop('orders');
  if (!shop) return null;
  const { s = '', q = '' } = await searchParams;
  const d = db();
  let query = d.from('shop_orders').select('id, code, status, total, subtotal, discount, paid_by, created_at, paid_at, shop_coupons(code), shop_customers(username, contact), shop_order_items(id, name, qty, total, status, delivered, fulfillment, customer_info)')
    .eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(100);
  if (s === 'queued') query = query.eq('status', 'processing');
  else if (s) query = query.eq('status', s);
  const term = q.trim().replace(/^#/, '');
  if (/^[A-Fa-f0-9]{3,8}$/.test(term)) query = query.ilike('code', `${term.toUpperCase()}%`);
  const [{ data }, ...counts] = await Promise.all([
    query,
    ...TABS.map(([k]) => { let c = d.from('shop_orders').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id); if (k === 'queued') c = c.eq('status', 'processing'); else if (k) c = c.eq('status', k); return c; }),
  ]);
  type R = { id: string; code: string; status: string; total: number; subtotal: number | null; discount: number; paid_by: string | null; created_at: string; paid_at: string | null;
    shop_coupons: { code: string } | null; shop_customers: { username: string; contact: string } | null; shop_order_items: AdminOrder['items'] };
  let rows: AdminOrder[] = ((data ?? []) as unknown as R[]).map((o) => ({
    id: o.id, code: o.code, status: o.status, total: Number(o.total), subtotal: o.subtotal === null ? null : Number(o.subtotal), discount: Number(o.discount ?? 0), coupon: o.shop_coupons?.code ?? '', paidBy: o.paid_by, when: when(o.created_at), paidAt: when(o.paid_at),
    user: o.shop_customers?.username ?? '-', contact: o.shop_customers?.contact ?? '', items: o.shop_order_items.map((i) => ({ ...i, total: Number(i.total) })),
  }));
  if (term && !/^[A-Fa-f0-9]{3,8}$/.test(term)) rows = rows.filter((r) => r.user.includes(term.toLowerCase()));
  return (
    <>
      <div className="page-head"><div><h1>ออเดอร์</h1><p>กดแถวเพื่อดูรายละเอียด · ส่งของ (สินค้าสั่งทำ) · คืนเงิน</p></div>
        <div className="acts">{can(shop.plan, 'export') ? <a href="/api/admin/export?type=orders" className="btn">⬇ ส่งออก Excel</a> : <a href="https://sysrent.shop" target="_blank" rel="noopener noreferrer" className="btn">🔒 Excel (Max)</a>}</div></div>
      <section className="card">
        <form className="toolbar" action={to('/admin/orders')}>
          {s && <input type="hidden" name="s" value={s} />}
          <input className="input" name="q" defaultValue={q} placeholder="🔍 เลขออเดอร์ / ชื่อผู้ใช้" />
          <div className="seg">{TABS.map(([k, l], i) => <Link key={k} href={to('/admin/orders') + (k ? `?s=${k}` : '')} className={s === k ? 'on' : ''} style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 8, fontSize: 13 }}>{l}<span style={{ color: 'var(--faint)', marginLeft: 4 }}>{counts[i].count ?? 0}</span></Link>)}</div>
        </form>
        <OrdersTable rows={rows} />
        <div className="tbl-foot"><span>แสดง {rows.length} รายการล่าสุด</span></div>
      </section>
    </>
  );
}
