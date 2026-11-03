import Link from 'next/link';
import { redirect } from 'next/navigation';
import { baht, getShop } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { db } from '@/lib/db';
import { ORDER_STATUS } from '@/lib/status';

export const dynamic = 'force-dynamic';

export default async function Orders() {
  const me = await getCustomer();
  if (!me) redirect('/login?next=/orders');
  const shop = (await getShop())!;
  const { data } = await db().from('shop_orders').select('code, status, total, created_at, expires_at, shop_order_items(name)')
    .eq('shop_id', shop.id).eq('customer_id', me.id).order('created_at', { ascending: false }).limit(50);
  const rows = (data ?? []).map((o) => ({ ...o, status: o.status === 'pending' && new Date(o.expires_at).getTime() < Date.now() ? 'cancelled' : o.status }));
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>ออเดอร์ของฉัน</h1>
      {!rows.length ? <div className="card success"><p className="muted">ยังไม่มีออเดอร์</p><Link href="/" className="btn primary">ไปเลือกสินค้า</Link></div> : (
        <div className="card orders">
          <div className="row head"><span>เลขออเดอร์</span><span>รายการ</span><span>วันที่</span><span style={{ textAlign: 'right' }}>ยอด / สถานะ</span></div>
          {rows.map((o) => {
            const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
            return (
              <Link key={o.code} href={o.status === 'pending' ? `/checkout/${o.code}` : `/orders/${o.code}`} className="row">
                <span className="num" style={{ fontWeight: 600 }}>#{o.code}</span>
                <span>{(o.shop_order_items as { name: string }[]).map((i) => i.name).join(', ')}</span>
                <span className="muted" style={{ fontSize: 14 }}>{new Date(o.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}><b className="num">{baht(Number(o.total))}</b><span className={`pill ${st.tone}`}>{st.label}</span></span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
