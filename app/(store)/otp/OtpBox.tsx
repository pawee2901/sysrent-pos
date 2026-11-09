'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import { AppLogo } from '@/components/AppLogo';
import type { OtpAccount } from '@/lib/otp-access';

type Hit = { code: string | null; link: string | null; subject: string; from: string; date: string };
const time = (s: string) => new Date(s).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

export function OtpBox({ accounts, apps }: { accounts: OtpAccount[]; apps: { id: string; name: string; image: string; template: string }[] }) {
  const [account, setAccount] = useState(accounts[0]?.email ?? '');
  const [appId, setAppId] = useState(apps[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(''); setHits(null);
    const r = await api<{ hits: Hit[] }>('/api/otp', { account, appId });
    setBusy(false);
    if (r.ok) setHits(r.data.hits); else setErr(r.error);
  }
  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => notify('คัดลอกรหัสแล้ว'), () => {});
  }

  if (!accounts.length) return <div className="card card-pad muted">ยังไม่มีสินค้าที่ค้นหา OTP ได้ หรือสินค้าหมดอายุแล้ว</div>;
  if (!apps.length) return <div className="card card-pad muted">ร้านยังไม่ได้ตั้งค่าแอปสำหรับค้นหา OTP</div>;

  return (
    <>
      <form className="card card-pad" onSubmit={search} style={{ display: 'grid', gap: 12 }}>
        <label className="field"><span>อีเมลบัญชี</span>
          <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
            {accounts.map((a) => <option key={a.email} value={a.email}>{a.email}{a.product ? ` · ${a.product}` : ''}</option>)}
          </select></label>
        <div className="field"><span>แอป</span>
          <div className="otp-apps" role="radiogroup" aria-label="เลือกแอป">
            {apps.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={a.id === appId} className={`otp-app${a.id === appId ? ' on' : ''}`} onClick={() => setAppId(a.id)}>
                <AppLogo image={a.image} template={a.template} name={a.name} /><small>{a.name}</small>
              </button>
            ))}
          </div></div>
        {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>{busy ? 'กำลังค้นหา…' : 'ค้นหารหัส'}</button>
      </form>

      {hits && !hits.length && <div className="card card-pad muted" role="status">ยังไม่พบรหัสใน 15 นาทีล่าสุด ลองขอรหัสใหม่แล้วค้นอีกครั้ง</div>}
      {hits?.map((h) => (
        <div key={`${h.date}${h.subject}`} className="card card-pad" style={{ display: 'grid', gap: 8 }}>
          {h.code && <button type="button" className="btn lg block num" style={{ fontSize: 28, letterSpacing: 4 }} onClick={() => copy(h.code as string)} aria-label={`คัดลอกรหัส ${h.code}`}>{h.code}</button>}
          {h.link && <a className="btn primary block" href={h.link} target="_blank" rel="noopener noreferrer nofollow">เปิดลิงก์ยืนยัน</a>}
          <small className="muted">{time(h.date)} · {h.subject}</small>
        </div>
      ))}
    </>
  );
}
