'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import { PALETTES, okHex, type Frame, type Palette } from '@/lib/palette';

export type DesignInit = { ready: boolean; palette: Palette; frame: Frame };
const FIELDS: [keyof Palette, string, string][] = [
  ['accent', 'สีหลัก', 'ปุ่ม · ราคา · ไฮไลต์'], ['accent2', 'สีคู่ไล่เฉด', 'ใช้ไล่สีกับสีหลัก'],
  ['bg', 'พื้นหลังร้าน', 'สีพื้นทั้งหน้า'], ['surface', 'สีการ์ด / กล่อง', 'พื้นของกล่องและการ์ด'], ['text', 'สีตัวอักษร', 'ข้อความทั่วไป'],
];

/**
 * ออกแบบทั้งร้าน (แบบ Canva): โทนสีสำเร็จรูป + ปรับเองทีละสี · หัวเว็บ · ท้ายเว็บ · เมนูล่างมือถือ
 * onLive = ส่งโทนสีไปให้หน้าจำลองเปลี่ยนทันที (ยังไม่บันทึก)
 */
export function DesignPanel({ init, onLive, onClose }: { init: DesignInit; onLive: (p: Palette) => void; onClose: () => void }) {
  const [p, setP] = useState<Palette>(init.palette ?? {});
  const [f, setF] = useState<Frame>(init.frame ?? {});
  const [busy, setBusy] = useState(false);
  const setPal = (n: Palette) => { setP(n); onLive(n); };

  async function save() {
    setBusy(true);
    const r = await api('/api/admin/settings', { action: 'design', palette: p, frame: f });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('บันทึกการออกแบบร้านแล้ว ✓');
  }

  return (
    <div className="lb-props">
      <div className="lb-props-head"><span aria-hidden>🎨</span><div><b>ออกแบบทั้งร้าน</b><small>โทนสี · หัวเว็บ · ท้ายเว็บ — มีผลทุกหน้าของร้าน</small></div>
        <button type="button" className="btn ghost sm lb-close" style={{ display: 'inline-flex' }} aria-label="ปิด" onClick={onClose}>✕</button></div>
      {!init.ready && <p className="lb-warn" style={{ margin: 0 }}>⚠️ ต้องรัน SQL <code>0056_shop_design.sql</code> ก่อน ถึงจะบันทึกได้</p>}

      <div className="field"><span>ชุดสีสำเร็จรูป (กดแล้วปรับต่อเองได้)</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
          <button type="button" onClick={() => setPal({})} style={tile(!Object.values(p).some(okHex))}>
            <span style={{ display: 'grid', placeItems: 'center', height: 34, borderRadius: 8, border: '1px dashed var(--line)', fontSize: 11 }}>ตามธีม</span><small>ค่าเดิม</small></button>
          {PALETTES.map((x) => { const on = JSON.stringify(x.p) === JSON.stringify(p); return (
            <button key={x.key} type="button" onClick={() => setPal({ ...x.p })} style={tile(on)} title={x.name}>
              <span style={{ display: 'flex', height: 34, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <i style={{ flex: 2, background: x.p.bg }} /><i style={{ flex: 2, background: x.p.surface }} /><i style={{ flex: 1.4, background: `linear-gradient(135deg, ${x.p.accent}, ${x.p.accent2})` }} /><i style={{ flex: 1, background: x.p.text }} /></span>
              <small>{x.name}</small></button>); })}
        </div></div>

      <div className="field"><span>ปรับสีเอง</span>
        <div style={{ display: 'grid', gap: 6 }}>{FIELDS.map(([k, l, d]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer' }}>
            <input type="color" value={okHex(p[k]) ? p[k] : '#ffffff'} onChange={(e) => setPal({ ...p, [k]: e.target.value.toLowerCase() })} style={{ width: 34, height: 30, border: 0, padding: 0, background: 'none', cursor: 'pointer' }} />
            <span style={{ flex: 1, display: 'grid' }}><b style={{ fontSize: 13 }}>{l}</b><small className="muted" style={{ fontSize: 11.5 }}>{okHex(p[k]) ? p[k] : 'ตามธีม'} · {d}</small></span>
            {okHex(p[k]) && <button type="button" className="btn ghost sm" onClick={(e) => { e.preventDefault(); const n = { ...p }; delete n[k]; setPal(n); }}>ตามธีม</button>}
          </label>))}</div>
        <small className="faint">ถ้าร้านตั้ง &quot;พื้นหลัง&quot; เป็นรูป / ฉากเทศกาลไว้ จะเห็นรูปนั้นแทนสีพื้น</small></div>

      <div className="field"><span>หัวเว็บ</span>
        <div className="lb-seg">{([['left', 'โลโก้ชิดซ้าย'], ['center', 'โลโก้ตรงกลาง']] as const).map(([k, l]) => <button key={k} type="button" className={(f.logo ?? 'left') === k ? 'on' : ''} onClick={() => setF({ ...f, logo: k })}>{l}</button>)}</div>
        <label className="lb-check" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}><input type="checkbox" checked={f.search !== false} onChange={(e) => setF({ ...f, search: e.target.checked })} />โชว์ช่องค้นหาที่หัวเว็บ</label></div>

      <div className="field"><span>ท้ายเว็บ</span>
        <textarea className="input" rows={3} maxLength={300} value={f.footer ?? ''} placeholder={'ข้อความท้ายเว็บ (ไม่บังคับ) เช่น\nเปิดทุกวัน 09:00–24:00 · ตอบแชทไวใน 5 นาที'} onChange={(e) => setF({ ...f, footer: e.target.value })} />
        <label className="lb-check" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}><input type="checkbox" checked={f.footerLinks !== false} onChange={(e) => setF({ ...f, footerLinks: e.target.checked })} />โชว์ลิงก์ท้ายเว็บ (หน้าแรก · ออเดอร์ · เงื่อนไข · ช่องทางติดต่อ)</label></div>

      <div className="field"><span>มือถือ</span>
        <label className="lb-check" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}><input type="checkbox" checked={f.tabbar !== false} onChange={(e) => setF({ ...f, tabbar: e.target.checked })} />โชว์เมนูล่าง (หน้าแรก · ตะกร้า · ประวัติ · บัญชี)</label></div>

      <div className="lb-props-foot"><button type="button" className="btn primary" style={{ width: '100%' }} disabled={busy || !init.ready} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึกการออกแบบร้าน'}</button></div>
    </div>
  );
}

const tile = (on: boolean): React.CSSProperties => ({ display: 'grid', gap: 4, padding: 6, borderRadius: 12, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface)', cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'center', fontSize: 11.5 });
