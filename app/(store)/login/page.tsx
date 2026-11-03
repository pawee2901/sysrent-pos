'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/components/Cart';

/** เข้าสู่ระบบ / สมัครสมาชิกของร้าน (ชื่อผู้ใช้ + รหัสผ่าน · ไม่ต้องยืนยันอีเมล) */
function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(params.get('m') === 'register' ? 'register' : 'login');
  const [f, setF] = useState({ username: '', password: '', password2: '', contact: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const next = (() => { const n = params.get('next') ?? '/'; return /^\/(?![/\\])[\w\-/?=&.%]*$/.test(n) ? n : '/'; })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'register' && f.password !== f.password2) { setErr('รหัสผ่านสองช่องไม่ตรงกัน'); return; }
    setBusy(true); setErr('');
    const r = await api(`/api/auth/${mode}`, { username: f.username.trim().toLowerCase(), password: f.password, contact: f.contact.trim() });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.replace(next); router.refresh();
  }

  return (
    <div style={{ maxWidth: 420, margin: '20px auto' }}>
      <div className="card card-pad">
        <div className="seg-tabs" role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 18 }}>
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={`btn ${mode === m ? 'primary' : ''}`} onClick={() => { setMode(m); setErr(''); }}>{m === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button>
          ))}
        </div>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <label className="field"><span>ชื่อผู้ใช้</span><input className="input" autoComplete="username" value={f.username} maxLength={20} placeholder="a-z, 0-9, _ (3–20 ตัว)" onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} required /></label>
          <label className="field"><span>รหัสผ่าน</span><input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} maxLength={72} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
          {mode === 'register' && <>
            <label className="field"><span>ยืนยันรหัสผ่าน</span><input className="input" type="password" autoComplete="new-password" value={f.password2} maxLength={72} onChange={(e) => setF({ ...f, password2: e.target.value })} required /></label>
            <label className="field"><span>LINE ID หรือเบอร์โทร (ไว้ให้ร้านติดต่อ)</span><input className="input" value={f.contact} maxLength={60} placeholder="ไม่บังคับ" onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
          </>}
          {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
          <button type="submit" className="btn primary lg block" disabled={busy}>{busy ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button>
        </form>
      </div>
    </div>
  );
}

export default function Login() {
  return <Suspense><LoginInner /></Suspense>;
}
