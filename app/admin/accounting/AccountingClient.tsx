'use client';
import { ThaiDateInput } from '@/components/ThaiDateInput';
import { to } from '@/lib/routes';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';

export type Ledger = {
  period: { key: string; label: string; from: string; to: string };
  totals: { revenue: number; cost: number; refunded: number; expenses: number; orders: number };
  orders: { code: string; when: string; user: string; paidBy: string; items: string; revenue: number; cost: number; profit: number; refunded: number }[];
  more: number;
  products: { name: string; qty: number; revenue: number; cost: number; profit: number }[];
  expenses: { id: string; date: string; category: string; note: string; amount: number }[];
  missingCost: number; costReady: boolean; expensesReady: boolean; today: string;
};

const PERIODS: [string, string][] = [['today', 'วันนี้'], ['7d', '7 วัน'], ['month', 'เดือนนี้'], ['lastmonth', 'เดือนที่แล้ว'], ['year', 'ปีนี้']];
const CATS = ['ซื้อบัญชี / สต็อก', 'ค่าโฆษณา', 'ค่าเว็บ / ระบบ', 'ค่าแรงแอดมิน', 'ค่าธรรมเนียม', 'อื่น ๆ'];
const thDate = (s: string) => new Date(`${s}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

/** บัญชีร้าน: สรุปกำไร · รายการขาย · กำไรตามสินค้า · รายจ่ายอื่น (จดเอง) */
export function AccountingClient({ l }: { l: Ledger }) {
  const router = useRouter();
  const t = l.totals;
  const gross = t.revenue - t.cost;
  const net = gross - t.expenses;
  const [f, setF] = useState({ spent_on: l.today, category: CATS[0], note: '', amount: '' });
  const [busy, setBusy] = useState(false);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api('/api/admin/expenses', { action: 'add', spent_on: f.spent_on, category: f.category, note: f.note, amount: Number(f.amount) });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('บันทึกรายจ่ายแล้ว'); setF({ ...f, note: '', amount: '' }); router.refresh();
  }
  async function delExpense(id: string, label: string) {
    if (!(await ask(`ลบรายจ่าย "${label}"?`, { ok: 'ลบ', danger: true }))) return;
    const r = await api('/api/admin/expenses', { action: 'delete', id });
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('ลบแล้ว'); router.refresh();
  }

  return (
    <>
      <div className="page-head"><div><h1>บัญชี</h1><p>{l.period.label} · {thDate(l.period.from)} – {thDate(l.period.to)} · {t.orders.toLocaleString('th-TH')} ออเดอร์</p></div></div>
      <nav className="acc-periods">{PERIODS.map(([k, label]) => <Link key={k} href={to('/admin/accounting') + (k === 'month' ? '' : `?p=${k}`)} className={l.period.key === k ? 'on' : ''}>{label}</Link>)}</nav>

      {!l.costReady && <div className="card card-pad acc-warn">⚠️ ต้องรัน SQL <code>0019_accounting.sql</code> ก่อน ระบบถึงจะจำต้นทุนตอนขายได้ (ตอนนี้ต้นทุนเป็น 0)</div>}
      {l.costReady && l.missingCost > 0 && <div className="card card-pad acc-warn">💡 มี {l.missingCost} รายการที่ขายตอนยังไม่ได้ใส่ต้นทุน (นับต้นทุนเป็น 0) — ใส่ช่อง &quot;ต้นทุน ฿&quot; ในแพ็กเกจที่ <Link href={to('/admin/products')}>สินค้า</Link> แล้วออเดอร์ใหม่จะคิดกำไรถูกต้อง</div>}

      <div className="acc-kpis">
        <div className="card acc-kpi"><span>รายรับ (ยอดขาย)</span><b className="num">{baht(t.revenue)}</b><small>{t.refunded > 0 ? `หักคืนเงินแล้ว ${baht(t.refunded)}` : 'หลังหักส่วนลดคูปอง'}</small></div>
        <div className="card acc-kpi"><span>ต้นทุนสินค้า</span><b className="num">{baht(t.cost)}</b><small>ต้นทุนตอนขาย</small></div>
        <div className="card acc-kpi profit"><span>กำไรขั้นต้น</span><b className="num">{baht(gross)}</b><small>มาร์จิ้น {pct(gross, t.revenue)}</small></div>
        <div className="card acc-kpi"><span>รายจ่ายอื่น</span><b className="num">{baht(t.expenses)}</b><small>{l.expenses.length} รายการที่จดไว้</small></div>
        <div className={`card acc-kpi net ${net < 0 ? 'neg' : ''}`}><span>กำไรสุทธิ</span><b className="num">{baht(net)}</b><small>กำไรขั้นต้น − รายจ่ายอื่น</small></div>
      </div>

      <div className="acc-grid">
        <section className="card">
          <div className="card-head"><h2>รายการขาย</h2><span className="muted" style={{ fontSize: 13 }}>ทุกออเดอร์ที่ลูกค้าจ่ายแล้ว</span></div>
          {!l.orders.length ? <p className="muted card-pad" style={{ margin: 0 }}>ยังไม่มียอดขายในช่วงนี้</p> : (
            <table className="tbl acctbl">
              <thead><tr><th>ออเดอร์</th><th>สินค้า</th><th className="r">รายรับ</th><th className="r">ต้นทุน</th><th className="r">กำไร</th></tr></thead>
              <tbody>{l.orders.map((o) => (
                <tr key={o.code} style={{ cursor: 'default' }}>
                  <td className="ac-code"><span className="code">#{o.code}</span><small>{o.when} · @{o.user}</small></td>
                  <td className="ac-items">{o.items}{o.refunded > 0 && <small style={{ color: 'var(--bad)' }}>คืนเงิน {baht(o.refunded)}</small>}</td>
                  <td className="r num ac-rev">{baht(o.revenue)}</td>
                  <td className="r num muted ac-cost">{baht(o.cost)}</td>
                  <td className={`r num ac-profit ${o.profit < 0 ? 'neg' : 'pos'}`}><b>{baht(o.profit)}</b></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {l.more > 0 && <div className="tbl-foot"><span>แสดง 200 รายการล่าสุด (ยอดรวมด้านบนนับครบทุก {t.orders.toLocaleString('th-TH')} ออเดอร์)</span></div>}
        </section>

        <div className="acc-side">
          <section className="card">
            <div className="card-head"><h2>กำไรตามสินค้า</h2></div>
            {!l.products.length ? <p className="muted card-pad" style={{ margin: 0 }}>ยังไม่มีข้อมูล</p> : (
              <div className="acc-products">{l.products.map((p) => (
                <div key={p.name} className="acc-prod">
                  <div><b>{p.name}</b><small className="muted">ขาย {p.qty} ชิ้น · รายรับ {baht(p.revenue)} · ต้นทุน {baht(p.cost)}</small></div>
                  <b className={`num ${p.profit < 0 ? 'neg' : 'pos'}`}>{baht(p.profit)}</b>
                </div>
              ))}</div>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>รายจ่ายอื่น</h2><span className="muted num" style={{ fontSize: 13 }}>{baht(t.expenses)}</span></div>
            <form className="form acc-exform" onSubmit={addExpense}>
              <div className="two">
                <div className="field"><span>วันที่</span><ThaiDateInput label="วันที่" value={f.spent_on} max={l.today} clearable={false} onChange={(v) => setF({ ...f, spent_on: v })} /></div>
                <label className="field"><span>จำนวนเงิน ฿</span><input className="input" inputMode="decimal" placeholder="เช่น 350" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} /></label>
              </div>
              <label className="field"><span>หมวด</span><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span>รายละเอียด (ไม่บังคับ)</span><input className="input" maxLength={200} placeholder="เช่น ซื้อ Netflix Premium 2 บัญชี" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
              <button type="submit" className="btn primary" disabled={busy || !l.expensesReady || !(Number(f.amount) > 0)}>+ บันทึกรายจ่าย</button>
              {!l.expensesReady && <small style={{ color: 'var(--warn)' }}>ต้องรัน SQL 0019_accounting.sql ก่อน</small>}
            </form>
            {l.expenses.length > 0 && (
              <div className="acc-exlist">{l.expenses.map((e) => (
                <div key={e.id} className="acc-ex">
                  <div><b>{e.category}</b><small className="muted">{thDate(e.date)}{e.note && ` · ${e.note}`}</small></div>
                  <span className="num">{baht(e.amount)}</span>
                  <button type="button" className="icon-btn" aria-label="ลบรายจ่าย" onClick={() => delExpense(e.id, `${e.category} ${baht(e.amount)}`)}>✕</button>
                </div>
              ))}</div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
