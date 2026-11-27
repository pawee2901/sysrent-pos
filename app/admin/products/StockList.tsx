'use client';
import { useEffect, useState } from 'react';
import { api } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import css from './dform.module.css';

type Row = { content: string; ids: string[]; at: string };
export type MoveTarget = { id: string; label: string };

/** รายการในสต็อกที่ยังไม่ขาย (ชิ้นที่เหมือนกันรวมเป็นแถวเดียว) · เลือก → ย้ายไปแพ็กเกจอื่น / ลบ */
export function StockList({ optionId, targets, onChanged }: { optionId: string; targets: MoveTarget[]; onChanged: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set()); // key = id แรกของแถว
  const [to, setTo] = useState('');
  const others = targets.filter((t) => t.id !== optionId);

  async function load() {
    const r = await api<{ items: { id: string; content: string; created_at: string }[]; total: number }>('/api/admin/products', { action: 'stock_list', optionId });
    if (!r.ok) { setErr(r.error); setRows([]); return; }
    const m = new Map<string, Row>();
    for (const it of r.data.items) {
      const g = m.get(it.content);
      if (g) g.ids.push(it.id); else m.set(it.content, { content: it.content, ids: [it.id], at: it.created_at });
    }
    setRows([...m.values()]); setTotal(r.data.total); setErr(''); setSel(new Set());
  }
  useEffect(() => { setRows(null); load(); }, [optionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const picked = (rows ?? []).filter((r) => sel.has(r.ids[0]));
  const ids = picked.flatMap((r) => r.ids);
  const toggle = (k: string) => { const n = new Set(sel); if (n.has(k)) n.delete(k); else n.add(k); setSel(n); };

  async function remove(list: Row[]) {
    const n = list.reduce((s, r) => s + r.ids.length, 0);
    if (!(await ask(`ลบ ${n} ชิ้นออกจากสต็อก?`, { text: 'ลูกค้าจะไม่ได้รับชิ้นนี้ · ชิ้นที่ขายไปแล้วไม่โดนลบ', ok: 'ลบ', danger: true }))) return;
    setBusy(true);
    const r = await api<{ removed: number }>('/api/admin/products', { action: 'stock_delete', optionId, ids: list.flatMap((x) => x.ids) });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify(`ลบแล้ว ${r.data.removed} ชิ้น`);
    await load(); onChanged();
  }
  async function move() {
    const t = others.find((x) => x.id === to);
    if (!t || !ids.length) return;
    if (!(await ask(`ย้าย ${ids.length} ชิ้นไป "${t.label}"?`, { text: 'ชิ้นที่ย้ายจะไปขายในแพ็กเกจนั้นแทน · ลูกค้าที่พรีออเดอร์ไว้ได้ของทันที', ok: 'ย้าย' }))) return;
    setBusy(true);
    const r = await api<{ notice: string }>('/api/admin/products', { action: 'stock_move', optionId, ids, to });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify(r.data.notice); setTo('');
    await load(); onChanged();
  }

  if (!rows) return <p className="muted" style={{ margin: 0 }}>กำลังโหลด…</p>;
  if (err) return <p style={{ color: 'var(--bad)', margin: 0 }}>{err}</p>;
  if (!rows.length) return <p className="muted" style={{ margin: 0 }}>ยังไม่มีของในสต็อก · ไปที่แท็บ &quot;เติมสต็อก&quot;</p>;
  const all = sel.size === rows.length;
  return (
    <div className={css.list}>
      <div className={css.lHead}>
        <label className={css.chk}><input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.ids[0])))} />เลือกทั้งหมด</label>
        <small className="muted">พร้อมขาย {total.toLocaleString('th-TH')} ชิ้น{total > 500 ? ' · แสดง 500 ชิ้นแรก' : ''}</small>
      </div>
      {rows.map((r, i) => {
        const key = r.ids[0];
        const first = r.content.split('\n').find((l) => l.trim()) ?? '';
        return (
          <div key={key} className={`${css.item}${sel.has(key) ? ` ${css.picked}` : ''}`}>
            <input type="checkbox" className={css.box1} checked={sel.has(key)} onChange={() => toggle(key)} aria-label={`เลือกชิ้นที่ ${i + 1}`} />
            <button type="button" className={css.body} onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>
              {open === key ? <pre>{r.content}</pre> : <span>{first}{r.content.includes('\n') ? ' …' : ''}</span>}
            </button>
            {r.ids.length > 1 && <span className="pill plain">× {r.ids.length}</span>}
          </div>
        );
      })}
      {ids.length > 0 && (
        <div className={css.bulk}>
          <b>เลือก {ids.length} ชิ้น</b>
          {others.length > 0 && <>
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="ย้ายไปแพ็กเกจ">
              <option value="">ย้ายไปแพ็กเกจ…</option>
              {others.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button type="button" className="btn primary sm" disabled={busy || !to} onClick={move}>↪ ย้าย</button>
          </>}
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => remove(picked)}>🗑 ลบ</button>
        </div>
      )}
    </div>
  );
}
