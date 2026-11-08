'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ask, notify } from '@/components/dialog';
import { api, baht } from '@/components/Cart';

export type Coupon = {
  id: string; code: string; kind: 'percent' | 'amount'; value: number; minTotal: number; maxDiscount: number | null;
  maxUses: number | null; used: number; expiresAt: string | null; active: boolean; given: number;
};
type Form = { code: string; kind: 'percent' | 'amount'; value: string; min_total: string; max_discount: string; max_uses: string; expires: string };
const blank: Form = { code: '', kind: 'percent', value: '10', min_total: '', max_discount: '', max_uses: '', expires: '' };
const num = (s: string) => (s.trim() === '' ? null : Number(s));
const date = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });

/** คูปองส่วนลด: ตาราง + แผงสร้างโค้ดใหม่ */
export function CouponsClient({ rows }: { rows: Coupon[] }) {
  const router = useRouter();
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function create() {
    if (!f) return;
    setBusy(true); setMsg('');
    // วันหมดอายุ = สิ้นวันนั้นตามเวลาไทย
    const expires_at = f.expires ? new Date(`${f.expires}T23:59:59+07:00`).toISOString() : null;
    const r = await api('/api/admin/coupons', { action: 'create', code: f.code, kind: f.kind, value: Number(f.value), min_total: num(f.min_total) ?? 0,
      max_discount: num(f.max_discount), max_uses: num(f.max_uses), expires_at });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    setF(null); router.refresh();
  }
  async function simple(body: object, confirmText?: string) {
    if (confirmText && !(await ask(confirmText, { danger: true, ok: 'ลบ' }))) return;
    const r = await api<{ notice?: string }>('/api/admin/coupons', body);
    if (!r.ok) { notify(r.error, 'error'); return; }
    if (r.data.notice) notify(r.data.notice, 'info');
    router.refresh();
  }
  const now = Date.now();
  const live = rows.filter((c) => c.active && (!c.expiresAt || new Date(c.expiresAt).getTime() > now) && (c.maxUses === null || c.used < c.maxUses));

  return (
    <>
      <div className="page-head"><div><h1>คูปองส่วนลด</h1><p>ลูกค้าใส่โค้ดในหน้าตะกร้า · นับสิทธิ์เมื่อจ่ายเงินสำเร็จ · 1 คนใช้ได้ 1 ครั้งต่อโค้ด</p></div>
        <div className="acts"><button type="button" className="btn primary" onClick={() => { setF(blank); setMsg(''); }}>+ สร้างคูปอง</button></div></div>
      <div className="kpis">
        <div className="card kpi"><span className="lbl">ใช้งานได้ตอนนี้</span><span className="val num">{live.length}</span><span className="delta mute">จาก {rows.length} โค้ด</span></div>
        <div className="card kpi"><span className="lbl">ถูกใช้ไปแล้ว</span><span className="val num">{rows.reduce((s, c) => s + c.used, 0).toLocaleString('th-TH')}</span><span className="delta mute">ครั้ง</span></div>
        <div className="card kpi"><span className="lbl">ส่วนลดที่ให้ไป</span><span className="val num">{baht(rows.reduce((s, c) => s + c.given, 0))}</span><span className="delta mute">รวมทุกโค้ด</span></div>
        <div className="card kpi"><span className="lbl">ใช้มากสุด</span><span className="val" style={{ fontSize: 20 }}>{[...rows].sort((a, b) => b.used - a.used)[0]?.code ?? '—'}</span><span className="delta mute">{[...rows].sort((a, b) => b.used - a.used)[0]?.used ?? 0} ครั้ง</span></div>
      </div>
      <section className="card">
        {!rows.length ? <div className="card-pad"><p className="muted" style={{ margin: 0 }}>ยังไม่มีคูปอง — กด &quot;+ สร้างคูปอง&quot; เช่น โค้ด NEW10 ลด 10% สำหรับลูกค้าใหม่</p></div> : (
          <table className="tbl">
            <thead><tr><th>โค้ด</th><th>ส่วนลด</th><th>เงื่อนไข</th><th className="r">ใช้แล้ว</th><th>หมดอายุ</th><th>เปิดใช้</th><th /></tr></thead>
            <tbody>{rows.map((c) => {
              const expired = !!c.expiresAt && new Date(c.expiresAt).getTime() <= now;
              const full = c.maxUses !== null && c.used >= c.maxUses;
              return (
                <tr key={c.id} style={{ opacity: c.active && !expired && !full ? 1 : .55, cursor: 'default' }}>
                  <td className="m-full"><span className="code">{c.code}</span>{(expired || full) && <small>{expired ? 'หมดอายุแล้ว' : 'ใช้ครบแล้ว'}</small>}</td>
                  <td><b>{c.kind === 'percent' ? `${c.value}%` : baht(c.value)}</b>{c.kind === 'percent' && c.maxDiscount !== null && <small>สูงสุด {baht(c.maxDiscount)}</small>}</td>
                  <td className="m-hide muted">{c.minTotal > 0 ? `ซื้อครบ ${baht(c.minTotal)}` : 'ไม่มีขั้นต่ำ'}</td>
                  <td className="r num">{c.used.toLocaleString('th-TH')}{c.maxUses !== null && <small>จาก {c.maxUses.toLocaleString('th-TH')}</small>}</td>
                  <td className="m-hide muted">{c.expiresAt ? date(c.expiresAt) : 'ไม่หมดอายุ'}</td>
                  <td><button type="button" className={`toggle${c.active ? ' on' : ''}`} aria-label="เปิด/ปิดคูปอง" onClick={() => simple({ action: 'toggle', id: c.id, active: !c.active })} /></td>
                  <td className="r"><button type="button" className="btn ghost sm" aria-label={`ลบ ${c.code}`} onClick={() => simple({ action: 'delete', id: c.id }, `ลบคูปอง ${c.code}?`)}>🗑</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </section>

      <div className={`drawer-bg${f ? ' open' : ''}`} onClick={() => setF(null)} />
      <aside className={`drawer${f ? ' open' : ''}`} aria-hidden={!f}>
        {f && <>
          <div className="drawer-head"><b style={{ flex: 1, fontSize: 17 }}>สร้างคูปอง</b><button type="button" className="icon-btn" onClick={() => setF(null)} aria-label="ปิด">✕</button></div>
          <div className="drawer-body">
            <label className="field"><span>โค้ด (ลูกค้าพิมพ์)</span><input className="input" value={f.code} maxLength={20} placeholder="เช่น NEW10" style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '.05em' }}
              onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></label>
            <div className="field"><span>ประเภทส่วนลด</span>
              <div className="seg" style={{ width: 'fit-content' }}>
                <button type="button" className={f.kind === 'percent' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'percent' })}>ลดเป็น %</button>
                <button type="button" className={f.kind === 'amount' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'amount', max_discount: '' })}>ลดเป็นบาท</button>
              </div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="field"><span>{f.kind === 'percent' ? 'ลด (%)' : 'ลด (บาท)'}</span><input className="input" inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^\d.]/g, '') })} /></label>
              {f.kind === 'percent'
                ? <label className="field"><span>ลดสูงสุด (บาท)</span><input className="input" inputMode="decimal" value={f.max_discount} placeholder="ไม่จำกัด" onChange={(e) => setF({ ...f, max_discount: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                : <span />}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="field"><span>ยอดซื้อขั้นต่ำ (บาท)</span><input className="input" inputMode="decimal" value={f.min_total} placeholder="ไม่มี" onChange={(e) => setF({ ...f, min_total: e.target.value.replace(/[^\d.]/g, '') })} /></label>
              <label className="field"><span>ใช้ได้ทั้งหมด (ครั้ง)</span><input className="input" inputMode="numeric" value={f.max_uses} placeholder="ไม่จำกัด" onChange={(e) => setF({ ...f, max_uses: e.target.value.replace(/\D/g, '') })} /></label>
            </div>
            <label className="field"><span>ใช้ได้ถึงวันที่ (ไม่บังคับ)</span><input className="input" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></label>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>💡 ลูกค้าแต่ละคนใช้โค้ดเดียวกันได้ 1 ครั้ง · ออเดอร์ที่ไม่จ่ายเงินจะไม่นับสิทธิ์</p>
            {msg && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{msg}</p>}
          </div>
          <div className="drawer-foot"><button type="button" className="btn primary" disabled={busy || f.code.length < 3 || !Number(f.value)} onClick={create}>{busy ? 'กำลังสร้าง…' : 'สร้างคูปอง'}</button></div>
        </>}
      </aside>
    </>
  );
}
