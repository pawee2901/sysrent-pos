'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';

/** ล็อกอินหลังบ้านร้าน (ชื่อผู้ดูแล + รหัสผ่านที่ตั้งตอนเช่า) */
export function AdminLogin({ shopName }: { shopName: string }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await api('/api/admin/login', { username: u.trim(), password: p });
    setBusy(false);
    if (r.ok) window.location.reload(); else setErr(r.error);
  }
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form onSubmit={submit} className="card card-pad" style={{ width: 'min(400px, 100%)', display: 'grid', gap: 12 }}>
        <div><h1 style={{ fontSize: 22 }}>หลังบ้าน · {shopName}</h1><p className="muted" style={{ margin: '4px 0 0' }}>ใช้ชื่อผู้ดูแลและรหัสผ่านที่ตั้งไว้ตอนเช่าเว็บ</p></div>
        <label className="field"><span>ชื่อผู้ดูแล</span><input className="input" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} required /></label>
        <label className="field"><span>รหัสผ่าน</span><input className="input" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></label>
        {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>ลืมรหัสผ่าน? ติดต่อ SysRent เพื่อรีเซ็ต</p>
      </form>
    </main>
  );
}
