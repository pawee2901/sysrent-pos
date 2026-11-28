'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';

export type CanAsk = { itemId: string; name?: string };

/** ขอ OTP ครบแล้ว → ปุ่ม "ขอรหัส OTP เพิ่ม" + ช่องเขียนเหตุผล → แอดมินอนุมัติที่หลังบ้าน */
export function OtpAskBox({ ask, account }: { ask: CanAsk; account: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [err, setErr] = useState('');

  async function send() {
    setBusy(true); setErr('');
    const r = await api('/api/otp/ask', { itemId: ask.itemId, account, note: note.trim() });
    setBusy(false);
    if (r.ok) setDone('ส่งคำขอแล้ว ✓ รอแอดมินอนุมัติ แล้วกลับมากดค้นหาอีกครั้ง');
    else if (r.status === 409) setDone(r.error); else setErr(r.error);
  }

  if (done) return <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--accent-soft)', fontSize: 14 }}>📨 {done}</div>;
  if (!open) return <button type="button" className="btn block" onClick={() => setOpen(true)}>📝 ขอรหัส OTP เพิ่ม</button>;
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <b style={{ fontSize: 14.5 }}>📝 ขอรหัส OTP เพิ่ม{ask.name ? ` · ${ask.name}` : ''}</b>
      <textarea className="input" rows={3} maxLength={500} autoFocus value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="บอกแอดมินว่าทำไมต้องขอเพิ่ม เช่น กดขอรหัสแล้วแต่เข้าแอปไม่ทัน / ออกจากระบบเอง" />
      {err && <small style={{ color: 'var(--bad)' }}>{err}</small>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)} disabled={busy}>ยกเลิก</button>
        <button type="button" className="btn primary" style={{ flex: 1 }} disabled={busy || !note.trim()} onClick={send}>{busy ? 'กำลังส่ง…' : 'ส่งคำขอให้แอดมิน'}</button>
      </div>
    </div>
  );
}
