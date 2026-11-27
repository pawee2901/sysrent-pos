'use client';
import { useEffect, useState } from 'react';
import { api } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import css from './dform.module.css';

type Row = { content: string; ids: string[]; at: string };

/** รายการในสต็อกที่ยังไม่ขาย (ชิ้นที่เหมือนกันรวมเป็นแถวเดียว) · ลบชิ้นที่ใส่ผิดได้ */
export function StockList({ optionId, onChanged }: { optionId: string; onChanged: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    const r = await api<{ items: { id: string; content: string; created_at: string }[]; total: number }>('/api/admin/products', { action: 'stock_list', optionId });
    if (!r.ok) { setErr(r.error); setRows([]); return; }
    const m = new Map<string, Row>();
    for (const it of r.data.items) {
      const g = m.get(it.content);
      if (g) g.ids.push(it.id); else m.set(it.content, { content: it.content, ids: [it.id], at: it.created_at });
    }
    setRows([...m.values()]); setTotal(r.data.total); setErr('');
  }
  useEffect(() => { setRows(null); load(); }, [optionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(row: Row) {
    if (!(await ask(row.ids.length > 1 ? `ลบชิ้นนี้ทั้ง ${row.ids.length} ชิ้น?` : 'ลบชิ้นนี้ออกจากสต็อก?', { text: 'ลูกค้าจะไม่ได้รับชิ้นนี้ · ชิ้นที่ขายไปแล้วไม่โดนลบ', ok: 'ลบ', danger: true }))) return;
    setBusy(row.ids[0]);
    const r = await api<{ removed: number }>('/api/admin/products', { action: 'stock_delete', optionId, ids: row.ids });
    setBusy('');
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify(`ลบแล้ว ${r.data.removed} ชิ้น`);
    await load(); onChanged();
  }

  if (!rows) return <p className="muted" style={{ margin: 0 }}>กำลังโหลด…</p>;
  if (err) return <p style={{ color: 'var(--bad)', margin: 0 }}>{err}</p>;
  if (!rows.length) return <p className="muted" style={{ margin: 0 }}>ยังไม่มีของในสต็อก · ไปที่แท็บ &quot;เติมสต็อก&quot;</p>;
  return (
    <div className={css.list}>
      <small className="muted">พร้อมขาย {total.toLocaleString('th-TH')} ชิ้น · ระบบส่งชิ้นที่เพิ่มก่อนให้ลูกค้าก่อน{total > 500 ? ' · แสดง 500 ชิ้นแรก' : ''}</small>
      {rows.map((r, i) => {
        const key = r.ids[0];
        const first = r.content.split('\n').find((l) => l.trim()) ?? '';
        return (
          <div key={key} className={css.item}>
            <span className={css.no}>{i + 1}</span>
            <button type="button" className={css.body} onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>
              {open === key ? <pre>{r.content}</pre> : <span>{first}{r.content.includes('\n') ? ' …' : ''}</span>}
            </button>
            {r.ids.length > 1 && <span className="pill plain">× {r.ids.length} คน</span>}
            <button type="button" className="btn ghost sm" disabled={busy === key} onClick={() => remove(r)}>ลบ</button>
          </div>
        );
      })}
    </div>
  );
}
