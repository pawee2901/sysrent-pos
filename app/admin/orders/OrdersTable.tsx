'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/components/dialog';
import { DeliverBox } from './DeliverBox';
import { api, baht } from '@/components/Cart';
import { ITEM_STATUS, ORDER_STATUS } from '@/lib/status';

type Item = { id: string; name: string; qty: number; total: number; status: string; delivered: string | null; fulfillment: string; customer_info: string | null };
export type AdminOrder = { id: string; code: string; status: string; total: number; subtotal: number | null; discount: number; coupon: string; paidBy: string | null; when: string; paidAt: string; user: string; contact: string; items: Item[] };

/** ยอดคืนเงินต่อรายการ = ตามสัดส่วนที่จ่ายจริง (ออเดอร์ที่ใช้คูปอง) — ตรงกับ shop_refund_item */
const refundOf = (o: AdminOrder, i: Item) => (o.subtotal ? Math.round((i.total * o.total / o.subtotal) * 100) / 100 : i.total);

/** ตารางออเดอร์ + แผงรายละเอียดเลื่อนจากขวา (ส่งของ / คืนเงิน) */
export function OrdersTable({ rows, mailOn }: { rows: AdminOrder[]; mailOn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<AdminOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function resendMail(itemId: string) {
    setBusy(true); setErr('');
    const r = await api(`/api/admin/items/${itemId}`, { action: 'notify' });
    setBusy(false);
    if (r.ok) notify('ส่งอีเมลแจ้งลูกค้าแล้ว'); else setErr(r.error);
  }
  async function act(itemId: string, action: 'deliver' | 'refund', content: string, mail = true) {
    setBusy(true); setErr('');
    const r = await api(`/api/admin/items/${itemId}`, { action, content, mail });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    notify(action === 'deliver' ? 'ส่งให้ลูกค้าแล้ว ลูกค้ารับได้ที่หน้าประวัติการซื้อ' : 'คืนเงินเข้ากระเป๋าลูกค้าแล้ว');
    setOpen(null); router.refresh();
  }

  if (!rows.length) return <p className="muted card-pad" style={{ margin: 0 }}>ไม่มีออเดอร์</p>;
  return (
    <>
      <table className="tbl otbl">
        <thead><tr><th>ออเดอร์</th><th>ลูกค้า</th><th>สินค้า</th><th className="r">ยอด</th><th>สถานะ</th><th>ชำระด้วย</th></tr></thead>
        <tbody>
          {rows.map((o) => {
            const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
            return (
              <tr key={o.id} onClick={() => { setOpen(o); setErr(''); }}>
                <td className="o-code"><span className="code">#{o.code}</span><small>{o.when}</small></td>
                <td className="m-hide">@{o.user}</td>
                <td className="o-items">{o.items.map((i) => i.name).join(', ')}<small>@{o.user}</small></td>
                <td className="r num o-total"><b>{baht(o.total)}</b></td>
                <td className="o-st"><span className={`pill ${st.tone}`}>{st.label}</span></td>
                <td className="muted m-hide">{o.paidBy === 'wallet' ? 'กระเป๋าเงิน' : o.paidBy === 'promptpay' ? 'พร้อมเพย์' : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={`drawer-bg${open ? ' open' : ''}`} onClick={() => setOpen(null)} />
      <aside className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        {open && <>
          <div className="drawer-head"><div style={{ flex: 1 }}><b style={{ fontSize: 17 }}>ออเดอร์ #{open.code}</b><br /><span className={`pill ${(ORDER_STATUS[open.status] ?? ORDER_STATUS.pending).tone}`}>{(ORDER_STATUS[open.status] ?? ORDER_STATUS.pending).label}</span></div>
            <button type="button" className="icon-btn" onClick={() => setOpen(null)} aria-label="ปิด">✕</button></div>
          <div className="drawer-body">
            <dl className="dl">
              <dt>ลูกค้า</dt><dd>@{open.user}</dd>
              {open.contact && <><dt>ติดต่อ</dt><dd>{open.contact}</dd></>}
              {open.discount > 0 && <><dt>ส่วนลด</dt><dd>−{baht(open.discount)}{open.coupon && <> · โค้ด <b>{open.coupon}</b></>}</dd></>}
              <dt>ยอด</dt><dd><b>{baht(open.total)}</b> · {open.paidBy === 'wallet' ? 'กระเป๋าเงิน' : open.paidBy === 'promptpay' ? 'พร้อมเพย์' : 'ยังไม่ชำระ'}</dd>
              <dt>สั่งเมื่อ</dt><dd>{open.when}</dd><dt>จ่ายเมื่อ</dt><dd>{open.paidAt}</dd>
            </dl>
            {open.items.map((i) => {
              const is = ITEM_STATUS[i.status] ?? ITEM_STATUS.pending;
              return (
                <div key={i.id} className="card" style={{ padding: 14, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{i.name} ×{i.qty}</b><span className={`pill ${is.tone}`}>{is.label}</span></div>
                  {i.customer_info && <div className="delivered" style={{ background: 'var(--accent-soft)' }}>📝 ลูกค้ากรอก: {i.customer_info}</div>}
                  {i.delivered && <div className="delivered">{i.delivered}</div>}
                  {i.status === 'queued' && <DeliverBox key={i.id} busy={busy} refund={refundOf(open, i)} mailOn={mailOn} onDeliver={(c, mail) => act(i.id, 'deliver', c, mail)} onRefund={(why) => act(i.id, 'refund', why)} />}
                  {mailOn && i.fulfillment === 'manual' && i.status === 'delivered' && <button type="button" className="btn sm" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => resendMail(i.id)}>📧 แจ้งลูกค้าทางอีเมล</button>}
                </div>
              );
            })}
            {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
          </div>
        </>}
      </aside>
    </>
  );
}
