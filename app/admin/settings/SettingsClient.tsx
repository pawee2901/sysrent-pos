'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';

type S = { name: string; tagline: string; logo_url: string; accent: string; line_url: string; announcement: string; promptpay_id: string; receiver_name: string };
const COLORS: [string, string][] = [['indigo', '#5b5bd6'], ['pink', '#e64980'], ['emerald', '#0d9f6e'], ['orange', '#ea6a12'], ['sky', '#0e8fd1']];

/** ตั้งค่าร้าน + ตัวอย่างหน้าร้านบนมือถือ (เปลี่ยนแล้วเห็นทันที) */
export function SettingsClient({ initial, slug, admin }: { initial: S; slug: string; admin: string }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [pw, setPw] = useState({ username: admin, password: '', password2: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  async function save() {
    setBusy(true); setMsg('');
    const r = await api('/api/admin/settings', { action: 'shop', ...f });
    setBusy(false);
    setMsg(r.ok ? 'บันทึกแล้ว ✓' : r.error);
    if (r.ok) { document.documentElement.dataset.accent = f.accent; router.refresh(); }
  }
  async function savePw() {
    if (pw.password !== pw.password2) { setMsg('รหัสผ่านสองช่องไม่ตรงกัน'); return; }
    setBusy(true); setMsg('');
    const r = await api('/api/admin/settings', { action: 'admin', username: pw.username, password: pw.password });
    setBusy(false);
    setMsg(r.ok ? 'เปลี่ยนรหัสผ่านหลังบ้านแล้ว ✓' : r.error);
    if (r.ok) setPw({ ...pw, password: '', password2: '' });
  }
  async function upload(fl?: File) {
    if (!fl) return;
    const fd = new FormData(); fd.append('file', fl);
    const r = await api<{ url: string }>('/api/admin/upload', fd);
    if (r.ok) setF({ ...f, logo_url: r.data.url }); else setMsg(r.error);
  }
  const accent = COLORS.find(([k]) => k === f.accent)?.[1] ?? '#5b5bd6';

  return (
    <>
      <div className="page-head"><div><h1>ตั้งค่าร้าน</h1><p>เปลี่ยนแล้วกดบันทึก หน้าร้านอัปเดตทันที</p></div><div className="acts"><button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div></div>
      {msg && <p role="status" style={{ color: msg.includes('✓') ? 'var(--ok)' : 'var(--bad)', marginTop: -8 }}>{msg}</p>}
      <div className="set-grid">
        <div className="stack">
          <section className="card"><div className="card-head"><h2>ข้อมูลร้าน</h2></div>
            <div className="form">
              <div className="two"><label className="field"><span>ชื่อร้าน</span><input className="input" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
                <label className="field"><span>ที่อยู่เว็บ</span><input className="input" value={`${slug}.sysrent.shop`} disabled /></label></div>
              <label className="field"><span>ข้อความหน้าแรก</span><input className="input" value={f.tagline} maxLength={60} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></label>
              <div className="field"><span>โลโก้ร้าน</span><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {f.logo_url && <img src={f.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />}
                <button type="button" className="btn sm" onClick={() => file.current?.click()}>{f.logo_url ? 'เปลี่ยนโลโก้' : 'อัปโหลดโลโก้'}</button>
                {f.logo_url && <button type="button" className="btn ghost sm" onClick={() => setF({ ...f, logo_url: '' })}>เอาออก</button>}
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
              </div></div>
              <div className="field"><span>สีร้าน</span><div className="swatches">{COLORS.map(([k, c]) => <button key={k} type="button" className={`sw${f.accent === k ? ' on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, accent: k })} aria-label={`สี ${k}`} />)}</div></div>
              <div className="two"><label className="field"><span>ลิงก์ LINE ร้าน (ปุ่มลอย)</span><input className="input" value={f.line_url} maxLength={200} placeholder="https://lin.ee/xxxx" onChange={(e) => setF({ ...f, line_url: e.target.value })} /></label>
                <label className="field"><span>ประกาศแถบบน (ไม่บังคับ)</span><input className="input" value={f.announcement} maxLength={120} placeholder="เช่น 🎉 Netflix ลด 20%" onChange={(e) => setF({ ...f, announcement: e.target.value })} /></label></div>
            </div></section>
          <section className="card"><div className="card-head"><h2>รับเงิน</h2><span className={`pill ${f.promptpay_id && f.receiver_name ? 'ok' : 'warn'}`}>{f.promptpay_id && f.receiver_name ? 'พร้อมใช้' : 'ยังตั้งไม่ครบ'}</span></div>
            <div className="form">
              <div className="two"><label className="field"><span>พร้อมเพย์ (เบอร์ / เลขบัตร)</span><input className="input" inputMode="numeric" value={f.promptpay_id} maxLength={15} onChange={(e) => setF({ ...f, promptpay_id: e.target.value.replace(/\D/g, '') })} /></label>
                <label className="field"><span>ชื่อบัญชีตามสลิป (คั่น , ได้หลายแบบ)</span><input className="input" value={f.receiver_name} maxLength={200} placeholder="นาย สมชาย ใจดี, MR. SOMCHAI J" onChange={(e) => setF({ ...f, receiver_name: e.target.value })} /></label></div>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>✓ ตรวจสลิปอัตโนมัติโดย SysRent — ระบบเช็กว่าโอนเข้าเลขพร้อมเพย์ / ชื่อบัญชีนี้จริง · เงินเข้าบัญชีร้านโดยตรง</p>
            </div></section>
          <section className="card"><div className="card-head"><h2>บัญชีหลังบ้าน</h2></div>
            <div className="form">
              <label className="field"><span>ชื่อผู้ดูแล</span><input className="input" value={pw.username} maxLength={40} onChange={(e) => setPw({ ...pw, username: e.target.value })} /></label>
              <div className="two"><label className="field"><span>รหัสผ่านใหม่</span><input className="input" type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></label>
                <label className="field"><span>ยืนยันรหัสผ่าน</span><input className="input" type="password" autoComplete="new-password" value={pw.password2} onChange={(e) => setPw({ ...pw, password2: e.target.value })} /></label></div>
              <button type="button" className="btn" disabled={busy || pw.password.length < 8} onClick={savePw}>เปลี่ยนรหัสผ่านหลังบ้าน</button>
              <span className="faint" style={{ fontSize: 12 }}>อย่างน้อย 8 ตัว · เปลี่ยนแล้วเครื่องอื่นที่ล็อกอินอยู่จะหลุดออก</span>
            </div></section>
        </div>
        <section className="card preview"><div className="card-head"><h2>ตัวอย่างหน้าร้าน</h2><span className="pill accent plain">สด</span></div>
          <div className="phone" style={{ ['--accent' as string]: accent }}>
            <div className="phone-top"><span className="m" style={{ background: accent }}>{(f.name || 'ร').slice(0, 1).toUpperCase()}</span><span>{f.name || 'ชื่อร้าน'}</span></div>
            {f.announcement && <div style={{ background: accent, color: '#fff', fontSize: 10, padding: '4px 8px', textAlign: 'center' }}>{f.announcement}</div>}
            <div className="phone-body"><div className="phone-hero"><b>{f.tagline || 'ข้อความหน้าแรก'}</b><span className="btnp" style={{ background: accent }}>เลือกซื้อเลย</span></div>
              <div className="phone-grid">{['N', '▶', 'D+', 'S'].map((x, i) => <div key={x}><span className="applogo" style={{ background: ['#141414', '#ff0033', '#0b1d5c', '#1db954'][i], color: i === 0 ? '#e50914' : '#fff' }}>{x}</span><p><b style={{ color: accent }}>฿{[99, 59, 69, 49][i]}</b></p></div>)}</div></div>
          </div>
        </section>
      </div>
    </>
  );
}
