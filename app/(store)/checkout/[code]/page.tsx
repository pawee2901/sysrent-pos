import { notFound, redirect } from 'next/navigation';
import { getShop, baht } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { db } from '@/lib/db';
import { PayBox } from './PayBox';

export const dynamic = 'force-dynamic';

export default async function Checkout({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const me = await getCustomer();
  if (!me) redirect(`/login?next=/checkout/${code}`);
  if (!/^[A-F0-9]{8}$/.test(code)) notFound();
  const shop = (await getShop())!;
  const { data: o } = await db().from('shop_orders').select('code, status, total, expires_at, shop_order_items(id, name, qty, total)')
    .eq('shop_id', shop.id).eq('code', code).eq('customer_id', me.id).maybeSingle();
  if (!o) notFound();
  if (o.status !== 'pending') redirect(`/orders/${code}`);
  const items = (o.shop_order_items ?? []) as { id: string; name: string; qty: number; total: number }[];
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>ชำระเงิน</h1>
      <div className="co">
        <div className="card">
          <div className="card-head"><h3>ออเดอร์ #{o.code}</h3></div>
          {items.map((i) => <div key={i.id} className="line-item"><div className="grow"><b>{i.name}</b><small>จำนวน {i.qty}</small></div><b className="num">{baht(Number(i.total))}</b></div>)}
          <div className="card-pad" style={{ paddingTop: 8 }}><div className="sum-row total"><span>ยอดชำระ</span><b className="num">{baht(Number(o.total))}</b></div></div>
        </div>
        <div className="card card-pad"><PayBox code={o.code} total={Number(o.total)} balance={me.balance} expiresAt={o.expires_at} /></div>
      </div>
    </>
  );
}
