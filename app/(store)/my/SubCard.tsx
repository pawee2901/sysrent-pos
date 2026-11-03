'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/components/Cart';
import { AppLogo } from '@/components/AppLogo';

type S = { id: string; active: boolean; startsAt: string; endsAt: string; productId: string; name: string; image: string; template: string };
type Secret = { login: string; password: string; profile: string; pin: string };

export function SubCard({ s }: { s: S }) {
  const [sec, setSec] = useState<Secret | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const total = Math.max(1, new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime());
  const leftMs = new Date(s.endsAt).getTime() - Date.now();
  const days = Math.ceil(leftMs / 86_400_000);
  const tone = !s.active ? 'off' : days <= 3 ? 'warn' : '';
  const copy = (t: string) => navigator.clipboard?.writeText(t).catch(() => {});

  async function reveal() {
    if (sec) { setSec(null); return; }
    setBusy(true); setErr('');
    const r = await api<Secret>(`/api/my/${s.id}`);
    setBusy(false);
    if (r.ok) setSec(r.data); else setErr(r.error);
  }
  return (
    <article className={`card sub ${tone}`}>
      <div className="sub-top"><AppLogo image={s.image} template={s.template} name={s.name} /><div className="grow"><b>{s.name}</b></div>
        <span className={`pill ${tone === 'off' ? '' : tone === 'warn' ? 'warn' : 'ok'}`}>{tone === 'off' ? 'หมดอายุ' : tone === 'warn' ? 'ใกล้หมด' : 'ใช้งานอยู่'}</span></div>
      {s.active ? <>
        <div className="days"><span>เหลือ <b className="num">{days}</b> วัน</span><span className="faint" style={{ fontSize: 13 }}>ถึง {new Date(s.endsAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span></div>
        <div className="bar"><i style={{ width: `${Math.max(4, Math.min(100, (leftMs / total) * 100))}%` }} /></div>
        {sec && (
          <div className="secret">
            <span>อีเมล</span><code>{sec.login}</code><button type="button" className="copy" onClick={() => copy(sec.login)}>คัดลอก</button>
            <span>รหัสผ่าน</span><code>{sec.password}</code><button type="button" className="copy" onClick={() => copy(sec.password)}>คัดลอก</button>
            <span>โปรไฟล์</span><code>{sec.profile}{sec.pin ? ` · PIN ${sec.pin}` : ''}</code><span />
          </div>
        )}
        <div className="sub-acts">
          <button type="button" className="btn primary sm" disabled={busy} onClick={reveal}>{busy ? 'กำลังเปิด…' : sec ? 'ซ่อนรหัส' : '👁 ดูรหัส'}</button>
          {s.productId && <Link href={`/p/${s.productId}`} className={`btn sm${tone === 'warn' ? ' soft' : ''}`}>🛒 ซื้อเพิ่ม</Link>}
        </div>
      </> : <><p className="muted" style={{ margin: 0, fontSize: 14 }}>หมดอายุแล้ว — รหัสถูกซ่อนเพื่อความปลอดภัย</p>{s.productId && <div className="sub-acts"><Link href={`/p/${s.productId}`} className="btn soft sm">🛒 ซื้อใหม่</Link></div>}</>}
      {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
    </article>
  );
}
