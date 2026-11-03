'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { ITEM_STATUS, ORDER_STATUS } from '@/lib/status';

type Item = { id: string; name: string; qty: number; total: number; status: string; delivered: string | null; fulfillment: string };
export type AdminOrder = { id: string; code: string; status: string; total: number; paidBy: string | null; when: string; paidAt: string; user: string; contact: string; items: Item[] };

/** ตารางออเดอร์ + แผงรายละเอียดเลื่อนจากขวา (ส่งของ / คืนเงิน) */
export function OrdersTable({ rows }: { rows: AdminOrder[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<AdminOrder | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function act(itemId: string, action: 'deliver' | 'refund') {
    const content = (text[itemId] ?? '').trim();
    if (!content) { setErr(action === 'deliver' ? 'ใส่สิ่งที่ส่งให้ลูกค้าก่อน' : 'ใส่เหตุผลที่คืนเงิน (ลูกค้าเห็น)'); return; }
    if (action === 'refund' && !confirm('คืนเงินรายการนี้เข้ากระเป๋าลูกค้า?')) return;
    setBusy(true); setErr('');
    const r = await api(`/api/admin/items/${itemId}`, { action, content });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setOpen(null); router.refresh();
  }

  if (!rows.length) return <p className="muted card-pad" style={{ margin: 0 }}>ไม่มีออเดอร์</p>;
  return (
    <>
      <table className="tbl">
        <thead><tr><th>ออเดอร์</th><th>ลูกค้า</th><th>สินค้า</th><th className="r">ยอด</th><th>สถานะ</th><th>ชำระด้วย</th></tr></thead>
        <tbody>
          {rows.map((o) => {
            const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
            return (
              <tr key={o.id} onClick={() => { setOpen(o); setErr(''); }}>
                <td><span className="code">#{o.code}</span><small>{o.when}</small></td>
                <td className="m-hide">@{o.user}</td>
                <td className="m-full">{o.items.map((i) => i.name).join(', ')}<small>@{o.user}</small></td>
                <td className="r num"><b>{baht(o.total)}</b></td>
                <td><span className={`pill ${st.tone}`}>{st.label}</span></td>
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
              <dt>ยอด</dt><dd><b>{baht(open.total)}</b> · {open.paidBy === 'wallet' ? 'กระเป๋าเงิน' : open.paidBy === 'promptpay' ? 'พร้อมเพย์' : 'ยังไม่ชำระ'}</dd>
              <dt>สั่งเมื่อ</dt><dd>{open.when}</dd><dt>จ่ายเมื่อ</dt><dd>{open.paidAt}</dd>
            </dl>
            {open.items.map((i) => {
              const is = ITEM_STATUS[i.status] ?? ITEM_STATUS.pending;
              return (
                <div key={i.id} className="card" style={{ padding: 14, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{i.name} ×{i.qty}</b><span className={`pill ${is.tone}`}>{is.label}</span></div>
                  {i.delivered && <div className="delivered">{i.delivered}</div>}
                  {i.status === 'queued' && <>
                    <textarea className="input" rows={3} value={text[i.id] ?? ''} onChange={(e) => setText({ ...text, [i.id]: e.target.value })}
                      placeholder="ส่งของ: เช่น เชิญอีเมลเข้าครอบครัวแล้ว / บัญชี + รหัส · คืนเงิน: ใส่เหตุผล" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn danger" style={{ flex: 1 }} disabled={busy} onClick={() => act(i.id, 'refund')}>คืนเงิน {baht(i.total)}</button>
                      <button type="button" className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={() => act(i.id, 'deliver')}>ส่งของ</button>
                    </div>
                  </>}
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
