'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/components/dialog';
import { DeliverBox } from './DeliverBox';
import { api, baht } from '@/components/Cart';
import { ITEM_STATUS, ORDER_STATUS } from '@/lib/status';
import css from './orders.module.css';

type Item = { id: string; name: string; qty: number; total: number; status: string; delivered: string | null; fulfillment: string; customer_info: string | null };
export type AdminOrder = { id: string; code: string; status: string; total: number; subtotal: number | null; discount: number; coupon: string; paidBy: string | null; when: string; paidAt: string; user: string; contact: string; items: Item[]; avatar?: string };

/** ยอดคืนเงินต่อรายการ = ตามสัดส่วนที่จ่ายจริง (ออเดอร์ที่ใช้คูปอง) — ตรงกับ shop_refund_item */
const refundOf = (o: AdminOrder, i: Item) => (o.subtotal ? Math.round((i.total * o.total / o.subtotal) * 100) / 100 : i.total);

/** ออเดอร์แถวละรายการ (รูปลูกค้า · สินค้า · ยอด · สถานะ) · กดแถวเพื่อกางรายละเอียด (ส่งของ / คืนเงิน) */
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
    const r = await api<{ mail: { sent: boolean; message: string } | null }>(`/api/admin/items/${itemId}`, { action, content, mail });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    const done = action === 'deliver' ? 'ส่งให้ลูกค้าแล้ว ลูกค้ารับได้ที่หน้าประวัติการซื้อ' : 'คืนเงินเข้ากระเป๋าลูกค้าแล้ว';
    if (r.data.mail && !r.data.mail.sent) notify(`${done} แต่อีเมลไม่ออก: ${r.data.mail.message}`, 'error');
    else notify(r.data.mail ? `${done} · ส่งอีเมลแล้ว` : done);
    setOpen(null); router.refresh();
  }

  if (!rows.length) return <p className="muted card-pad" style={{ margin: 0 }}>ไม่มีออเดอร์</p>;
  return (
    <>
      <div className={css.list}>
        {rows.map((o) => {
          const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
          const on = open?.id === o.id;
          const items = o.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(' · ');
          return (
            <div key={o.id} className={`${css.row}${on ? ` ${css.open}` : ''}`}>
              <button type="button" className={css.sum} aria-expanded={on} onClick={() => { setOpen(on ? null : o); setErr(''); }}>
                <span className={css.av}>{o.avatar ? <img src={o.avatar} alt="" loading="lazy" /> : (o.user === '-' ? '?' : o.user.slice(0, 1).toUpperCase())}</span>
                <span className={css.main}><b><span className={css.user}>@{o.user}</span> ซื้อ {items || '—'}</b><small>#{o.code} · {o.when}{o.paidBy ? ` · ${o.paidBy === 'wallet' ? 'กระเป๋าเงิน' : 'พร้อมเพย์'}` : ''}</small></span>
                <span className={css.side}><b>{baht(o.total)}</b><span className={`pill ${st.tone}`}>{st.label}</span></span>
                <i className={css.chev} aria-hidden>⌄</i>
              </button>
              {on && (
                <div className={css.detail}>
                  <dl className="dl">
                    <dt>ลูกค้า</dt><dd>@{o.user}</dd>
                    {o.contact && <><dt>ติดต่อ</dt><dd>{o.contact}</dd></>}
                    {o.discount > 0 && <><dt>ส่วนลด</dt><dd>−{baht(o.discount)}{o.coupon && <> · โค้ด <b>{o.coupon}</b></>}</dd></>}
                    <dt>ยอด</dt><dd><b>{baht(o.total)}</b> · {o.paidBy === 'wallet' ? 'กระเป๋าเงิน' : o.paidBy === 'promptpay' ? 'พร้อมเพย์' : 'ยังไม่ชำระ'}</dd>
                    <dt>สั่งเมื่อ</dt><dd>{o.when}</dd><dt>จ่ายเมื่อ</dt><dd>{o.paidAt}</dd>
                  </dl>
                  {o.items.map((i) => {
                    const is = ITEM_STATUS[i.status] ?? ITEM_STATUS.pending;
                    return (
                      <div key={i.id} className={css.item}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><b>{i.name} ×{i.qty}</b><span className={`pill ${is.tone}`}>{i.status === 'queued' && i.fulfillment === 'stock' ? '📦 พรีออเดอร์ · รอเติมสต็อก' : is.label}</span></div>
                        {i.status === 'queued' && i.fulfillment === 'stock' && <small className="muted">เติมสต็อกแพ็กเกจนี้ที่หน้าสต็อก ระบบจะส่งให้ลูกค้าเองตามคิว · หรือส่งเอง / คืนเงินด้านล่าง</small>}
                        {i.customer_info && <div className="delivered" style={{ background: 'var(--accent-soft)' }}>📝 ลูกค้ากรอก: {i.customer_info}</div>}
                        {i.delivered && <div className="delivered">{i.delivered}</div>}
                        {i.status === 'queued' && <DeliverBox key={i.id} busy={busy} refund={refundOf(o, i)} mailOn={mailOn} onDeliver={(c, mail) => act(i.id, 'deliver', c, mail)} onRefund={(why) => act(i.id, 'refund', why)} />}
                        {mailOn && i.fulfillment === 'manual' && i.status === 'delivered' && <button type="button" className="btn sm" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => resendMail(i.id)}>📧 แจ้งลูกค้าทางอีเมล</button>}
                      </div>
                    );
                  })}
                  {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
