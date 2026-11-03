import { redirect } from 'next/navigation';
import { baht, getShop } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { db } from '@/lib/db';
import { TopupBox } from './TopupBox';

export const dynamic = 'force-dynamic';
const KIND: Record<string, string> = { topup: 'เติมเงิน', purchase: 'ซื้อสินค้า', refund: 'คืนเงิน', adjust: 'ร้านปรับยอด' };

export default async function Wallet() {
  const me = await getCustomer();
  if (!me) redirect('/login?next=/wallet');
  const shop = (await getShop())!;
  const { data: tx } = await db().from('shop_wallet_tx').select('id, kind, amount, note, created_at').eq('shop_id', shop.id).eq('customer_id', me.id).order('created_at', { ascending: false }).limit(30);
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>
      <div className="card card-pad" style={{ background: 'var(--accent)', color: '#fff', border: 0 }}>
        <span style={{ opacity: .85, fontSize: 14 }}>ยอดเงินคงเหลือ</span>
        <div className="num" style={{ fontFamily: 'var(--font-head)', fontSize: 36, fontWeight: 700 }}>{baht(me.balance)}</div>
      </div>
      <div className="card card-pad"><h3 style={{ fontSize: 16, marginBottom: 12 }}>เติมเงินด้วยพร้อมเพย์</h3><TopupBox /></div>
      <div className="card">
        <div className="card-head"><h3>ประวัติ</h3></div>
        {!tx?.length && <p className="muted card-pad" style={{ margin: 0 }}>ยังไม่มีรายการ</p>}
        {(tx ?? []).map((t) => (
          <div key={t.id} className="line-item">
            <div className="grow"><b>{KIND[t.kind] ?? t.kind}</b><small>{t.note} · {new Date(t.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</small></div>
            <b className="num" style={{ color: Number(t.amount) >= 0 ? 'var(--ok)' : 'inherit' }}>{Number(t.amount) >= 0 ? '+' : ''}{baht(Number(t.amount))}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
