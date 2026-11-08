'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';

/** มีสินค้าสั่งทำที่รออยู่ แต่ยังไม่มีอีเมล → ชวนใส่อีเมลรับแจ้งเตือน */
export function EmailPrompt() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api('/api/auth/email', { email });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('บันทึกอีเมลแล้ว'); router.refresh();
  }
  return (
    <form className="card email-prompt" onSubmit={save}>
      <div><b>📧 รับแจ้งเตือนทางอีเมล</b><small className="muted">ร้านทำเสร็จหรือคืนเงินเมื่อไหร่ เราจะแจ้งให้ทันที</small></div>
      <input className="input" type="email" required maxLength={120} placeholder="อีเมลของคุณ" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" className="btn primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
    </form>
  );
}
