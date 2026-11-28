'use client';
import { ThaiDateInput } from '@/components/ThaiDateInput';
import { to } from '@/lib/routes';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import type { Entry, LedgerData, MoneyAccount } from '@/lib/ledger';
import css from '../fin.module.css';

const PERIODS: [string, string][] = [['today', 'วันนี้'], ['7d', '7 วัน'], ['month', 'เดือนนี้'], ['lastmonth', 'เดือนที่แล้ว'], ['year', 'ปีนี้']];
const CAT_OUT = ['ซื้อบัญชี / สต็อก', 'ค่าโฆษณา', 'ค่าเว็บ / ระบบ', 'ค่าตรวจสลิป', 'ค่าแรงแอดมิน', 'ค่าธรรมเนียม', 'อื่น ๆ'];
const CAT_IN = ['ขายนอกระบบ', 'ตัวแทนโอน', 'ค่าบริการ', 'เงินลงทุน', 'อื่น ๆ'];
const KIND_LABEL: Record<MoneyAccount['kind'], string> = { bank: 'บัญชีธนาคาร', cash: 'เงินสด', wallet: 'วอลเล็ต', other: 'อื่น ๆ' };
const thDate = (s: string, long = false) => new Date(`${s}T00:00:00+07:00`).toLocaleDateString('th-TH', { weekday: long ? 'short' : undefined, day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');
const signed = (e: Entry) => (e.kind === 'in' ? `+${baht(e.amount)}` : e.kind === 'out' ? `−${baht(e.amount)}` : baht(e.amount));

type EntryForm = { id?: string; kind: Entry['kind']; on_date: string; amount: string; category: string; note: string; ref: string; account_id: string; to_account: string };
type AccForm = { id?: string; name: string; kind: MoneyAccount['kind']; number: string; opening: string; is_sales: boolean; active: boolean };

/** บัญชีร้าน: ภาพรวม (งบกำไรขาดทุน) · สมุดบัญชี · บัญชีเงิน — แบบทางการ อ่านง่ายบนมือถือ */
export function AccountingClient({ l }: { l: LedgerData }) {
  const router = useRouter();
  const t = l.totals;
  const [tab, setTab] = useState<'sum' | 'book' | 'acc'>('sum');
  const [filter, setFilter] = useState<'all' | 'in' | 'out' | 'transfer' | 'sale'>('all');
  const [accFilter, setAccFilter] = useState('');
  const [entry, setEntry] = useState<EntryForm | null>(null);
  const [acc, setAcc] = useState<AccForm | null>(null);
  const accName = (id: string | null) => l.accounts.find((a) => a.id === id)?.name ?? '';

  const income = t.sales + t.otherIn;
  const gross = t.sales - t.cost;
  const net = gross + t.otherIn - t.out;
  const accTotal = l.accounts.filter((a) => a.active).reduce((s, a) => s + a.balance, 0);

  const shown = useMemo(() => l.entries.filter((e) =>
    (filter === 'all' || (filter === 'sale' ? e.src === 'sale' : e.kind === filter && (filter !== 'in' || e.src === 'manual')))
    && (!accFilter || e.account === accFilter || e.toAccount === accFilter)), [l.entries, filter, accFilter]);
  const days = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of shown) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [shown]);

  const newEntry = (kind: Entry['kind'] = 'out'): EntryForm => ({
    kind, on_date: l.today, amount: '', category: kind === 'in' ? CAT_IN[0] : kind === 'out' ? CAT_OUT[0] : '', note: '', ref: '',
    account_id: l.accounts.find((a) => a.active && (kind === 'in' ? a.isSales : true))?.id ?? '', to_account: '',
  });
  const editEntry = (e: Entry) => setEntry({ id: e.id, kind: e.kind, on_date: e.date, amount: String(e.amount), category: e.category, note: e.note, ref: e.ref, account_id: e.account ?? '', to_account: e.toAccount ?? '' });
  const setPeriod = (k: string) => router.push(to('/admin/accounting') + (k === 'month' ? '' : `?p=${k}`));

  return (
    <div className={css.wrap}>
      <div className="page-head"><div><h1>บัญชี</h1><p>{l.period.label} · {thDate(l.period.from)} – {thDate(l.period.to)}</p></div>
        <div className="actions">
          <a className="btn" href={`/api/admin/export?type=ledger&p=${encodeURIComponent(l.period.key)}`}>ส่งออก Excel</a>
          <button type="button" className="btn primary" disabled={!l.ledgerReady} onClick={() => setEntry(newEntry())}>+ จดรายการ</button>
        </div></div>

      <div className={css.bar}>
        <div className={css.chips}>{PERIODS.map(([k, label]) => <Link key={k} href={to('/admin/accounting') + (k === 'month' ? '' : `?p=${k}`)} className={l.period.key === k ? css.on : ''}>{label}</Link>)}</div>
        <input type="month" className="input" style={{ width: 'auto', height: 34 }} aria-label="เลือกเดือน" value={/^\d{4}-\d{2}$/.test(l.period.key) ? l.period.key : ''} max={l.today.slice(0, 7)} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
      </div>

      {!l.ledgerReady && <p className={`${css.note} ${css.warn}`}>ต้องรัน SQL <code>0058_ledger.sql</code> ใน Supabase ก่อน ถึงจะจดรายรับ แยกบัญชีเงิน และโอนระหว่างบัญชีได้ (รายจ่ายเดิมย้ายเข้าสมุดบัญชีให้อัตโนมัติ)</p>}
      {!l.costReady && <p className={`${css.note} ${css.warn}`}>ต้องรัน SQL <code>0019_accounting.sql</code> ก่อน ระบบถึงจะจำต้นทุนตอนขายได้</p>}
      {l.costReady && l.missingCost > 0 && <p className={css.note}>มี {l.missingCost} รายการที่ขายตอนยังไม่ได้ใส่ต้นทุน (นับต้นทุนเป็น 0) — ใส่ &quot;ต้นทุน ฿&quot; ในแพ็กเกจที่ <Link href={to('/admin/products')} style={{ color: 'var(--accent)' }}>สินค้า</Link></p>}

      <div className={css.kpis}>
        <div className={css.kpi}><span>รายรับรวม</span><b>{baht(income)}</b><small>ขาย {baht(t.sales)} · อื่น {baht(t.otherIn)}</small></div>
        <div className={css.kpi}><span>ต้นทุนสินค้า</span><b>{baht(t.cost)}</b><small>{t.orders.toLocaleString('th-TH')} ออเดอร์</small></div>
        <div className={css.kpi}><span>ค่าใช้จ่าย</span><b>{baht(t.out)}</b><small>{l.outByCat.length} หมวด</small></div>
        <div className={css.kpi}><span>กำไรสุทธิ</span><b className={net < 0 ? css.neg : css.pos}>{baht(net)}</b><small>อัตรากำไร {pct(net, income)}</small></div>
      </div>

      <div className={css.tabs} role="tablist">
        {([['sum', 'ภาพรวม', null], ['book', 'สมุดบัญชี', l.entries.length], ['acc', 'บัญชีเงิน', l.accounts.length]] as const).map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? css.on : ''} onClick={() => setTab(k)}>{label}{n !== null && <b>{n}</b>}</button>))}
      </div>

      {tab === 'sum' && <>
        <section className={css.box}>
          <div className={css.boxHead}><h2>งบกำไรขาดทุน</h2><small>{l.period.label}</small></div>
          <table className={css.tbl}>
            <tbody>
              <tr><td>รายได้จากการขาย{t.refunded > 0 && <span className={css.sub}>หักคืนเงินแล้ว {baht(t.refunded)} · หลังหักส่วนลด</span>}</td><td className={css.r}>{baht(t.sales)}</td></tr>
              <tr><td style={{ paddingLeft: 28 }}>หัก ต้นทุนขาย</td><td className={css.r}>({baht(t.cost)})</td></tr>
              <tr><td><b>กำไรขั้นต้น</b><span className={css.sub}>อัตรากำไรขั้นต้น {pct(gross, t.sales)}</span></td><td className={css.r}><b>{baht(gross)}</b></td></tr>
              <tr><td>รายได้อื่น</td><td className={css.r}>{baht(t.otherIn)}</td></tr>
              {l.outByCat.length ? l.outByCat.map((c) => <tr key={c.category}><td style={{ paddingLeft: 28 }}>หัก {c.category}</td><td className={css.r}>({baht(c.amount)})</td></tr>)
                : <tr><td style={{ paddingLeft: 28 }}>หัก ค่าใช้จ่าย</td><td className={css.r}>({baht(0)})</td></tr>}
            </tbody>
            <tfoot><tr><td>กำไร (ขาดทุน) สุทธิ</td><td className={`${css.r} ${net < 0 ? css.neg : css.pos}`}>{baht(net)}</td></tr></tfoot>
          </table>
        </section>

        <section className={css.box}>
          <div className={css.boxHead}><h2>กำไรตามสินค้า</h2><small>{l.products.length} รายการ</small></div>
          {!l.products.length ? <p className={css.empty}>ยังไม่มียอดขายในช่วงนี้</p> : (
            <table className={css.tbl}>
              <thead><tr><th>สินค้า</th><th className={`${css.r} ${css.hideM}`}>จำนวน</th><th className={`${css.r} ${css.hideM}`}>รายรับ</th><th className={`${css.r} ${css.hideM}`}>ต้นทุน</th><th className={css.r}>กำไร</th></tr></thead>
              <tbody>{l.products.map((p) => (
                <tr key={p.name}><td>{p.name}<span className={css.sub}>ขาย {p.qty} ชิ้น<span className={css.mOnly}> · รับ {baht(p.revenue)} · ทุน {baht(p.cost)}</span></span></td>
                  <td className={`${css.r} ${css.hideM}`}>{p.qty}</td><td className={`${css.r} ${css.hideM}`}>{baht(p.revenue)}</td><td className={`${css.r} ${css.hideM}`}>{baht(p.cost)}</td>
                  <td className={`${css.r} ${p.profit < 0 ? css.neg : ''}`}><b>{baht(p.profit)}</b></td></tr>))}</tbody>
            </table>
          )}
        </section>
      </>}

      {tab === 'book' && <>
        <div className={css.bar}>
          <div className={`${css.chips} ${css.grow}`}>{([['all', 'ทั้งหมด'], ['sale', 'ยอดขาย'], ['in', 'รายรับอื่น'], ['out', 'รายจ่าย'], ['transfer', 'โอน']] as const).map(([k, label]) => (
            <button key={k} type="button" className={filter === k ? css.on : ''} onClick={() => setFilter(k)}>{label}</button>))}</div>
          {l.accounts.length > 0 && <select className="input" style={{ width: 'auto', height: 34 }} value={accFilter} aria-label="บัญชีเงิน" onChange={(e) => setAccFilter(e.target.value)}>
            <option value="">ทุกบัญชี</option>{l.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
        </div>
        <section className={css.box}>
          {!days.length ? <p className={css.empty}>ไม่มีรายการในช่วงนี้</p> : days.map(([date, list]) => {
            const dIn = list.filter((e) => e.kind === 'in').reduce((s, e) => s + e.amount, 0), dOut = list.filter((e) => e.kind === 'out').reduce((s, e) => s + e.amount, 0);
            return (
              <div key={date}>
                <div className={css.dateHead}><span>{thDate(date, true)}</span><span>รับ {baht(dIn)} · จ่าย {baht(dOut)}</span></div>
                {list.map((e) => {
                  const click = e.src === 'manual' && l.ledgerReady;
                  return (
                    <div key={e.id} className={css.row} role={click ? 'button' : undefined} tabIndex={click ? 0 : undefined} style={{ cursor: click ? 'pointer' : 'default' }}
                      onClick={() => click && editEntry(e)} onKeyDown={(k) => click && k.key === 'Enter' && editEntry(e)}>
                      <span className={`${css.tag} ${e.kind === 'in' ? css.tagIn : e.kind === 'out' ? css.tagOut : css.tagMove}`}>{e.src === 'sale' ? 'ขาย' : e.kind === 'in' ? 'รับ' : e.kind === 'out' ? 'จ่าย' : 'โอน'}</span>
                      <div className={css.main}>
                        <b>{e.src === 'sale' ? `ออเดอร์ #${e.ref}` : e.kind === 'transfer' ? `${accName(e.account) || '—'} → ${accName(e.toAccount) || '—'}` : e.category}</b>
                        <small>{[e.time, e.note, e.src === 'manual' && e.kind !== 'transfer' && accName(e.account), e.src === 'manual' && e.ref && `อ้างอิง ${e.ref}`].filter(Boolean).join(' · ')}</small>
                      </div>
                      <div className={css.amt}><span className={e.kind === 'in' ? css.pos : e.kind === 'out' ? css.neg : ''}>{signed(e)}</span>
                        {e.src === 'sale' && e.cost !== undefined && <small>ทุน {baht(e.cost)}</small>}</div>
                    </div>);
                })}
              </div>);
          })}
          {l.more > 0 && <p className={css.note} style={{ borderRadius: 0 }}>แสดง {l.entries.length} รายการล่าสุด — ดูครบทุกรายการในไฟล์ Excel</p>}
        </section>
      </>}

      {tab === 'acc' && <>
        {!l.accounts.length ? (
          <section className={css.box}>
            <div className={css.boxHead}><h2>บัญชีเงิน คืออะไร</h2><small>ไม่บังคับ — ไม่ใช้ก็ได้</small></div>
            <div style={{ padding: 16, display: 'grid', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7 }}>คือ <b>ที่เก็บเงินของร้าน</b> เช่น บัญชีธนาคารที่ลูกค้าโอนเข้า · เงินสดในมือ · TrueMoney Wallet<br />
                ใส่ไว้แล้วระบบจะบอกว่า <b>ตอนนี้แต่ละที่มีเงินเหลือเท่าไหร่</b> โดยไม่ต้องเปิดแอปธนาคารดู</p>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>
                <li>เพิ่มบัญชี แล้วใส่ <b style={{ color: 'var(--text)' }}>เงินที่มีอยู่ตอนนี้</b> (ดูจากแอปธนาคาร)</li>
                <li>ลูกค้าซื้อของ → ยอดขายบวกเข้าบัญชีที่รับเงินขายให้เอง</li>
                <li>จ่ายค่าของ / ค่าโฆษณา → กด <b style={{ color: 'var(--text)' }}>+ จดรายการ</b> เลือกว่าจ่ายจากบัญชีไหน ระบบหักให้</li>
              </ol>
              <div style={{ display: 'grid', gap: 8 }}>
                <small className="muted">เริ่มเลย — กดเลือก</small>
                <div className={css.bar}>
                  <button type="button" className="btn primary" disabled={!l.ledgerReady} onClick={() => setAcc({ name: 'บัญชีธนาคารร้าน', kind: 'bank', number: '', opening: '0', is_sales: true, active: true })}>+ บัญชีธนาคาร (รับเงินลูกค้า)</button>
                  <button type="button" className="btn" disabled={!l.ledgerReady} onClick={() => setAcc({ name: 'เงินสด', kind: 'cash', number: '', opening: '0', is_sales: false, active: true })}>+ เงินสด</button>
                  <button type="button" className="btn" disabled={!l.ledgerReady} onClick={() => setAcc({ name: 'TrueMoney Wallet', kind: 'wallet', number: '', opening: '0', is_sales: false, active: true })}>+ วอลเล็ต</button>
                </div>
              </div>
            </div>
          </section>
        ) : <p className={css.note}>ตัวเลขในแต่ละการ์ด = <b>เงินที่เหลืออยู่ตอนนี้</b> (ยอดเริ่มต้น + เงินเข้า − เงินออก) · บัญชีที่มีป้าย <b>รับเงินขาย</b> ยอดขายจากลูกค้าบวกเข้าให้เอง · แตะการ์ดเพื่อแก้ไข</p>}
        {l.accounts.length > 0 && <div className={css.accts}>
          {l.accounts.map((a) => (
            <button key={a.id} type="button" className={css.acct} style={{ opacity: a.active ? 1 : 0.55 }} disabled={!l.ledgerReady}
              onClick={() => setAcc({ id: a.id, name: a.name, kind: a.kind, number: a.number, opening: String(a.opening), is_sales: a.isSales, active: a.active })}>
              <span className={css.top}><b>{a.name}</b>{a.isSales && <span className={`${css.tag} ${css.tagIn}`}>รับเงินขาย</span>}{!a.active && <span className={css.tag}>ปิด</span>}</span>
              <b className={a.balance < 0 ? css.neg : ''}>{baht(a.balance)}</b>
              <small>{KIND_LABEL[a.kind]}{a.number ? ` · ${a.number}` : ''}</small>
            </button>))}
          <button type="button" className={`${css.acct} ${css.acctAdd}`} disabled={!l.ledgerReady} onClick={() => setAcc({ name: '', kind: 'bank', number: '', opening: '0', is_sales: !l.accounts.some((a) => a.isSales), active: true })}>+ เพิ่มบัญชีเงิน</button>
        </div>}
        {l.accounts.length > 0 && <div className={css.kpis} style={{ gridTemplateColumns: '1fr' }}><div className={css.kpi}><span>รวมทุกบัญชีที่เปิดใช้</span><b>{baht(accTotal)}</b></div></div>}
      </>}

      {entry && <EntryModal f0={entry} accounts={l.accounts} today={l.today} onClose={() => setEntry(null)} onSaved={() => { setEntry(null); router.refresh(); }} />}
      {acc && <AccModal f0={acc} onClose={() => setAcc(null)} onSaved={() => { setAcc(null); router.refresh(); }} />}
    </div>
  );
}

function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: React.ReactNode; foot: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className={css.mBg} onClick={onClose}>
      <div className={css.modal} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className={css.mHead}><b>{title}</b><button type="button" className="icon-btn" onClick={onClose} aria-label="ปิด">✕</button></div>
        <div className={css.mBody}>{children}</div>
        <div className={css.mFoot}>{foot}</div>
      </div>
    </div>
  );
}

function EntryModal({ f0, accounts, today, onClose, onSaved }: { f0: EntryForm; accounts: MoneyAccount[]; today: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(f0);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<EntryForm>) => setF({ ...f, ...p });
  const cats = f.kind === 'in' ? CAT_IN : CAT_OUT;
  const open = accounts.filter((a) => a.active || a.id === f.account_id || a.id === f.to_account);
  const amount = Number(f.amount);
  const okForm = amount > 0 && (f.kind === 'transfer' ? !!f.account_id && !!f.to_account && f.account_id !== f.to_account : !!f.category);
  async function save() {
    setBusy(true);
    const r = await api('/api/admin/ledger', { action: 'entry', id: f.id, kind: f.kind, on_date: f.on_date, amount, category: f.category, note: f.note, ref: f.ref, account_id: f.account_id || null, to_account: f.to_account || null });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('บันทึกรายการแล้ว'); onSaved();
  }
  async function del() {
    if (!f.id || !(await ask('ลบรายการนี้?', { ok: 'ลบ', danger: true }))) return;
    const r = await api('/api/admin/ledger', { action: 'delete_entry', id: f.id });
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('ลบแล้ว'); onSaved();
  }
  return (
    <Modal title={f.id ? 'แก้ไขรายการ' : 'จดรายการ'} onClose={onClose} foot={<>
      {f.id && <button type="button" className="btn ghost" style={{ flex: 'none', color: 'var(--bad)' }} onClick={del}>ลบ</button>}
      <button type="button" className="btn primary" disabled={busy || !okForm} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
      <div className={css.form}>
        <div className={css.kind} role="tablist">{([['in', 'รายรับ', css.onIn], ['out', 'รายจ่าย', css.onOut], ['transfer', 'โอนระหว่างบัญชี', '']] as const).map(([k, label, c]) => (
          <button key={k} type="button" role="tab" aria-selected={f.kind === k} className={f.kind === k ? `${css.on} ${c}` : ''}
            onClick={() => set({ kind: k, category: k === 'in' ? CAT_IN[0] : k === 'out' ? CAT_OUT[0] : '' })}>{label}</button>))}</div>
        <div className={css.two}>
          <label className="field"><span>จำนวนเงิน (บาท)</span><input className="input" inputMode="decimal" autoFocus placeholder="0.00" style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            value={f.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          <div className="field"><span>วันที่</span><ThaiDateInput label="วันที่" value={f.on_date} max={today} clearable={false} onChange={(v) => set({ on_date: v })} /></div>
        </div>
        {f.kind === 'transfer' ? (
          accounts.length < 2 ? <p className={`${css.note} ${css.warn}`}>ต้องมีบัญชีเงินอย่างน้อย 2 บัญชี (เพิ่มที่แท็บ บัญชีเงิน)</p> : (
            <div className={css.two}>
              <label className="field"><span>จากบัญชี</span><select className="input" value={f.account_id} onChange={(e) => set({ account_id: e.target.value })}><option value="">เลือกบัญชี</option>{open.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label className="field"><span>เข้าบัญชี</span><select className="input" value={f.to_account} onChange={(e) => set({ to_account: e.target.value })}><option value="">เลือกบัญชี</option>{open.filter((a) => a.id !== f.account_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            </div>)
        ) : (
          <div className={css.two}>
            <label className="field"><span>หมวด</span><select className="input" value={cats.includes(f.category) ? f.category : '__custom'} onChange={(e) => set({ category: e.target.value === '__custom' ? '' : e.target.value })}>
              {cats.map((c) => <option key={c}>{c}</option>)}<option value="__custom">พิมพ์หมวดเอง…</option></select>
              {!cats.includes(f.category) && <input className="input" style={{ marginTop: 6 }} maxLength={40} placeholder="ชื่อหมวด" value={f.category} onChange={(e) => set({ category: e.target.value })} />}</label>
            <label className="field"><span>{f.kind === 'in' ? 'เข้าบัญชี' : 'จ่ายจากบัญชี'}</span><select className="input" value={f.account_id} onChange={(e) => set({ account_id: e.target.value })}>
              <option value="">ไม่ระบุ</option>{open.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          </div>
        )}
        <label className="field"><span>รายละเอียด (ไม่บังคับ)</span><input className="input" maxLength={200} placeholder={f.kind === 'out' ? 'เช่น ซื้อ Netflix Premium 2 บัญชี' : f.kind === 'in' ? 'เช่น ตัวแทนโอนค่าสินค้า' : 'เช่น ถอนเงินเข้าบัญชีหลัก'} value={f.note} onChange={(e) => set({ note: e.target.value })} /></label>
        <label className="field"><span>เลขที่อ้างอิง (ไม่บังคับ)</span><input className="input" maxLength={40} placeholder="เช่น เลขที่ใบเสร็จ / เลขสลิป" value={f.ref} onChange={(e) => set({ ref: e.target.value })} /></label>
      </div>
    </Modal>
  );
}

function AccModal({ f0, onClose, onSaved }: { f0: AccForm; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(f0);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<AccForm>) => setF({ ...f, ...p });
  async function save() {
    setBusy(true);
    const r = await api('/api/admin/ledger', { action: 'account', id: f.id, name: f.name, kind: f.kind, number: f.number, opening: Number(f.opening) || 0, is_sales: f.is_sales, active: f.active });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('บันทึกบัญชีเงินแล้ว'); onSaved();
  }
  async function del() {
    if (!f.id || !(await ask(`ลบบัญชี "${f.name}"?`, { text: 'รายการที่จดไว้ยังอยู่ แต่จะไม่ระบุบัญชี', ok: 'ลบ', danger: true }))) return;
    const r = await api('/api/admin/ledger', { action: 'delete_account', id: f.id });
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('ลบแล้ว'); onSaved();
  }
  return (
    <Modal title={f.id ? 'แก้ไขบัญชีเงิน' : 'เพิ่มบัญชีเงิน'} onClose={onClose} foot={<>
      {f.id && <button type="button" className="btn ghost" style={{ flex: 'none', color: 'var(--bad)' }} onClick={del}>ลบ</button>}
      <button type="button" className="btn primary" disabled={busy || !f.name.trim()} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
      <div className={css.form}>
        <label className="field"><span>ชื่อบัญชี</span><input className="input" maxLength={40} placeholder="เช่น กสิกร ร้าน · เงินสดหน้าร้าน" value={f.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <div className={css.two}>
          <label className="field"><span>ประเภท</span><select className="input" value={f.kind} onChange={(e) => set({ kind: e.target.value as AccForm['kind'] })}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field"><span>เลขบัญชี (ไม่บังคับ)</span><input className="input" maxLength={40} placeholder="xxx-x-xxxxx-x" value={f.number} onChange={(e) => set({ number: e.target.value })} /></label>
        </div>
        <label className="field"><span>เงินที่มีอยู่ตอนนี้ (บาท)</span><input className="input" inputMode="decimal" value={f.opening} onChange={(e) => set({ opening: e.target.value.replace(/[^\d.-]/g, '') })} />
          <small className={css.help}>เปิดแอปธนาคารดูยอดตอนนี้แล้วใส่ตามนั้น ไม่รู้ใส่ 0 ก็ได้</small></label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}><input type="checkbox" checked={f.is_sales} onChange={(e) => set({ is_sales: e.target.checked })} style={{ marginTop: 3 }} />
          <span>ลูกค้าโอนเงินเข้าบัญชีนี้<small className={css.help} style={{ display: 'block' }}>ติ๊ก = ยอดขายจากลูกค้าบวกเข้าบัญชีนี้ให้เอง (เลือกได้บัญชีเดียว)</small></span></label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />เปิดใช้งาน</label>
      </div>
    </Modal>
  );
}
