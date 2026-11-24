'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import { CONTACTS_MAX, CONTACT_KINDS, contactError, type ContactKind, type ContactLink } from '@/lib/contacts';

/** ช่องทางติดต่อร้าน: เพิ่มได้หลายลิงก์ หลายแอป · ชื่อปุ่ม + คำอธิบาย · ใช้กับปุ่มลอย "ติดต่อเรา" และท้ายเว็บ */
export function ContactLinks({ init, ready, onSaved }: { init: ContactLink[]; ready: boolean; onSaved: (line: string, facebook: string) => void }) {
  const router = useRouter();
  const [list, setList] = useState<ContactLink[]>(init.length ? init : [{ kind: 'line', url: '', label: '', note: '' }]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const set = (i: number, p: Partial<ContactLink>) => { setList(list.map((c, k) => (k === i ? { ...c, ...p } : c))); setDirty(true); };
  const move = (i: number) => { const a = [...list]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setList(a); setDirty(true); };
  const kinds = Object.keys(CONTACT_KINDS) as ContactKind[];

  async function save() {
    const links = list.filter((c) => c.url.trim());
    const bad = links.map((c) => contactError(c)).find(Boolean);
    if (bad) { notify(bad, 'error'); return; }
    setBusy(true);
    const r = await api('/api/admin/settings', { action: 'contacts', links });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    setDirty(false);
    onSaved(links.find((c) => c.kind === 'line')?.url ?? '', links.find((c) => c.kind === 'facebook')?.url ?? '');
    notify(links.length ? 'บันทึกช่องทางติดต่อแล้ว ✓' : 'เอาปุ่มติดต่อออกแล้ว ✓'); router.refresh();
  }

  return (
    <section className="card">
      <div className="card-head"><h2>ช่องทางติดต่อร้าน</h2><span className="pill plain">{list.filter((c) => c.url.trim()).length} ลิงก์</span>
        <button type="button" className="btn primary sm" disabled={busy || !ready || !dirty} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>
      <div className="form">
        {!ready && <p style={{ color: 'var(--warn)', margin: 0 }}>⚠️ ต้องรัน SQL <code>0037_shop_contact_links.sql</code> ใน Supabase ก่อน</p>}
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>ใส่ได้หลายลิงก์ หลายแอป · แสดงที่ปุ่มลอย &quot;ติดต่อเรา&quot; และท้ายเว็บ · เรียงตามลำดับในรายการ</p>
        <div className="ct-list">{list.map((c, i) => {
          const k = CONTACT_KINDS[c.kind], err = c.url.trim() ? contactError(c) : '';
          return (
            <div key={i} className="ct-item">
              <div className="ct-head">
                <span className="ct-ic" style={{ background: k.color }}>{k.short}</span>
                <select className="input" value={c.kind} aria-label="แอป" onChange={(e) => set(i, { kind: e.target.value as ContactKind })}>{kinds.map((x) => <option key={x} value={x}>{CONTACT_KINDS[x].label}</option>)}</select>
                {i > 0 && <button type="button" className="btn ghost sm" aria-label="เลื่อนขึ้น" onClick={() => move(i)}>↑</button>}
                <button type="button" className="btn ghost sm" aria-label="ลบ" onClick={() => { setList(list.filter((_, x) => x !== i)); setDirty(true); }}>✕</button>
              </div>
              <input className="input" value={c.url} maxLength={300} placeholder={k.ph} aria-label="ลิงก์" inputMode={c.kind === 'phone' ? 'tel' : c.kind === 'email' ? 'email' : 'url'} onChange={(e) => set(i, { url: e.target.value })} />
              {err && <small style={{ color: 'var(--bad)' }}>{err}</small>}
              <div className="two">
                <input className="input" value={c.label} maxLength={40} placeholder={`ชื่อปุ่ม (ว่าง = ${k.label})`} aria-label="ชื่อปุ่ม" onChange={(e) => set(i, { label: e.target.value })} />
                <input className="input" value={c.note} maxLength={80} placeholder="คำอธิบาย เช่น ตอบไวใน 5 นาที" aria-label="คำอธิบาย" onChange={(e) => set(i, { note: e.target.value })} />
              </div>
            </div>
          );
        })}</div>
        {list.length < CONTACTS_MAX && <button type="button" className="btn" disabled={!ready} onClick={() => { setList([...list, { kind: 'facebook', url: '', label: '', note: '' }]); setDirty(true); }}>＋ เพิ่มลิงก์</button>}
      </div>
    </section>
  );
}
