'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import { AppLogo } from '@/components/AppLogo';
import { templateOf } from '@/lib/templates';
import type { OtpAccount } from '@/lib/otp-access';

type Hit = { code: string | null; link: string | null; subject: string; from: string; date: string };
type App = { id: string; name: string; image: string; template: string };
const time = (s: string) => new Date(s).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const tint = (a: App) => ({ '--app': templateOf(a.template)?.bg ?? 'var(--accent)' }) as React.CSSProperties;

/** ค้นหา OTP 3 ขั้น: เลือกแอป → เลือกอีเมลแล้วค้นหา → แสดงรหัส */
export function OtpBox({ accounts, apps }: { accounts: OtpAccount[]; apps: App[] }) {
  const [account, setAccount] = useState(accounts[0]?.email ?? '');
  const [app, setApp] = useState<App | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [pick, setPick] = useState(0);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!app) return;
    setBusy(true); setErr('');
    const r = await api<{ hits: Hit[] }>('/api/otp', { account, appId: app.id });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    if (!r.data.hits.length) { setErr('ไม่พบรหัสใน 15 นาทีล่าสุด กรุณากดขอรหัสจากแอปก่อน แล้วค้นหาอีกครั้ง'); return; }
    setHits(r.data.hits); setPick(0);
  }
  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => notify('คัดลอกรหัสแล้ว'), () => {});
  }

  if (!accounts.length) return <div className="card card-pad muted">ยังไม่มีสินค้าที่ค้นหา OTP ได้ หรือสินค้าหมดอายุแล้ว</div>;
  if (!apps.length) return <div className="card card-pad muted">ร้านยังไม่ได้ตั้งค่าแอปสำหรับค้นหา OTP</div>;

  if (!app) {
    return (
      <>
        <h2 className="otpf-title">เลือกแอปที่ต้องการรับรหัส</h2>
        <div className="otpf-grid">
          {apps.map((a) => (
            <button key={a.id} type="button" className="otpf-tile" style={tint(a)} onClick={() => { setApp(a); setErr(''); }}>
              <AppLogo image={a.image} template={a.template} name={a.name} /><b>{a.name}</b>
            </button>
          ))}
        </div>
      </>
    );
  }

  const tag = <span className="otpf-tag" style={tint(app)}>{app.name}</span>;
  const failed = err && <div className="otpf-err" role="alert">{err}</div>;

  if (!hits) {
    return (
      <form className="card card-pad otpf-card" onSubmit={search}>
        <div className="otpf-bar"><button type="button" className="otpf-back" onClick={() => { setApp(null); setErr(''); }}>← ย้อนกลับ</button>{tag}</div>
        <div className="otpf-center"><h3>ค้นหารหัสยืนยัน</h3><p className="muted">ขอรหัสจากแอปก่อน แล้วกดค้นหาภายใน 15 นาที</p></div>
        <label className="field"><span>อีเมลบัญชี</span>
          <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
            {accounts.map((a) => <option key={a.email} value={a.email}>{a.email}{a.product ? ` · ${a.product}` : ''}</option>)}
          </select></label>
        <button type="submit" className="btn primary lg block" disabled={busy}>{busy ? 'กำลังค้นหา…' : 'ค้นหารหัส'}</button>
        {failed}
      </form>
    );
  }

  const h = hits[pick] ?? hits[0];
  return (
    <section className="card card-pad otpf-card">
      <div className="otpf-bar"><button type="button" className="otpf-back" onClick={() => { setHits(null); setErr(''); }}>← ย้อนกลับ</button><small className="muted otpf-who">{account}</small></div>
      <div className="otpf-result">
        <span className="otpf-label">{h.code ? 'รหัสยืนยันตัวตน (OTP)' : 'ลิงก์ยืนยัน'}</span>
        {h.code && <button type="button" className="otpf-code" onClick={() => copy(h.code as string)} aria-label={`คัดลอกรหัส ${h.code}`}>{h.code}</button>}
        {h.code && <button type="button" className="btn primary" onClick={() => copy(h.code as string)}>คัดลอกรหัส</button>}
        {h.link && <a className={`btn${h.code ? '' : ' primary'}`} href={h.link} target="_blank" rel="noopener noreferrer nofollow">เปิดลิงก์ยืนยัน</a>}
        <small className="muted">{time(h.date)} · {h.subject}</small>
      </div>
      {hits.length > 1 && (
        <div className="otpf-list">
          <span className="otpf-label">รหัสอื่นใน 15 นาทีล่าสุด</span>
          {hits.map((x, i) => (
            <button key={`${x.date}${x.subject}`} type="button" className={`otpf-item${i === pick ? ' on' : ''}`} onClick={() => setPick(i)}>
              <b className="num">{x.code ?? 'ลิงก์ยืนยัน'}</b><small className="muted">{time(x.date)}</small>
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn block" disabled={busy} onClick={() => search()}>{busy ? 'กำลังค้นหา…' : 'ค้นหาใหม่อีกครั้ง'}</button>
      {failed}
    </section>
  );
}
