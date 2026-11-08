'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';

export function PasswordForm() {
  const [f, setF] = useState({ current: '', password: '', password2: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password !== f.password2) { setMsg({ ok: false, text: 'รหัสผ่านใหม่สองช่องไม่ตรงกัน' }); return; }
    setBusy(true); setMsg(null);
    const r = await api('/api/auth/password', { current: f.current, password: f.password });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setF({ current: '', password: '', password2: '' });
    setMsg({ ok: true, text: 'เปลี่ยนรหัสผ่านเรียบร้อย' });
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <label className="field"><span>รหัสผ่านเดิม</span><input className="input" type="password" autoComplete="current-password" value={f.current} maxLength={72} onChange={(e) => setF({ ...f, current: e.target.value })} required /></label>
      <label className="field"><span>รหัสผ่านใหม่</span><input className="input" type="password" autoComplete="new-password" value={f.password} minLength={6} maxLength={72} placeholder="อย่างน้อย 6 ตัว" onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
      <label className="field"><span>ยืนยันรหัสผ่านใหม่</span><input className="input" type="password" autoComplete="new-password" value={f.password2} maxLength={72} onChange={(e) => setF({ ...f, password2: e.target.value })} required /></label>
      {msg && <p style={{ color: msg.ok ? 'var(--good, #16a34a)' : 'var(--bad)', margin: 0 }} role="alert">{msg.text}</p>}
      <button type="submit" className="btn primary lg block" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่าน'}</button>
    </form>
  );
}
