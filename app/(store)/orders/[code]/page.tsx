import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { baht, getShop } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { db } from '@/lib/db';
import { ITEM_STATUS, ORDER_STATUS } from '@/lib/status';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ paid?: string }> }) {
  const [{ code }, { paid }] = await Promise.all([params, searchParams]);
  const me = await getCustomer();
  if (!me) redirect(`/login?next=/orders/${code}`);
  if (!/^[A-F0-9]{8}$/.test(code)) notFound();
  const shop = (await getShop())!;
  const { data: o } = await db().from('shop_orders').select('code, status, total, paid_by, created_at, paid_at, shop_order_items(id, name, qty, total, status, delivered)')
    .eq('shop_id', shop.id).eq('code', code).eq('customer_id', me.id).maybeSingle();
  if (!o) notFound();
  if (o.status === 'pending') redirect(`/checkout/${code}`);
  const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
  type I = { id: string; name: string; qty: number; total: number; status: string; delivered: string | null };
  const items = (o.shop_order_items ?? []) as I[];
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'grid', gap: 14 }}>
      {paid && <div className="card success" style={{ padding: 22 }}><div className="success-ic">✓</div><h2 style={{ fontSize: 20 }}>ชำระเงินสำเร็จ!</h2><p className="muted" style={{ margin: 0 }}>{o.status === 'completed' ? 'สินค้าของคุณอยู่ด้านล่าง' : 'ร้านกำลังดำเนินการ จะแจ้งผลในหน้านี้'}</p></div>}
      <div className="sec-head"><h1 style={{ fontSize: 24 }}>ออเดอร์ #{o.code}</h1><span className={`pill ${st.tone}`}>{st.label}</span></div>
      <div className="card">
        {items.map((i) => {
          const is = ITEM_STATUS[i.status] ?? ITEM_STATUS.pending;
          return (
            <div key={i.id} className="line-item" style={{ flexWrap: 'wrap' }}>
              <div className="grow"><b>{i.name}</b><small>จำนวน {i.qty} · {baht(Number(i.total))}</small></div>
              <span className={`pill ${is.tone}`}>{is.label}</span>
              {i.status === 'delivered' && i.delivered && <pre className="secret" style={{ width: '100%', margin: 0, display: 'block', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace' }}>{i.delivered}</pre>}
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>ชำระด้วย{o.paid_by === 'wallet' ? 'กระเป๋าเงิน' : 'พร้อมเพย์'} · มีปัญหาทักร้านพร้อมแจ้งเลข #{o.code}</p>
      <div style={{ textAlign: 'center' }}><Link href="/my" className="btn primary">ไปที่บัญชีของฉัน</Link></div>
    </div>
  );
}
