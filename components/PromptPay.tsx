'use client';
import { useEffect, useRef, useState } from 'react';
import { api, baht } from '@/components/Cart';

export type Qr = { topupId: string; amount: number; expiresAt: string; deadline: string; qrSvg: string };
export type Paid = { amount: number; balance?: number; order?: string; orderError?: string };

const left = (iso: string) => Math.max(0, new Date(iso).getTime() - Date.now());

/** QR พร้อมเพย์ของร้าน + นับถอยหลัง + อัปสลิป (ระบบตรวจอัตโนมัติ) */
export function PromptPayPanel({ qr, onPaid, onRenew }: { qr: Qr; onPaid: (p: Paid) => void; onRenew: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  void now;
  const qLeft = left(qr.expiresAt), sLeft = left(qr.deadline);
  const mm = Math.floor(qLeft / 60_000), ss = Math.floor((qLeft % 60_000) / 1000);

  async function send() {
    if (!file) { ref.current?.click(); return; }
    setBusy(true); setErr('');
    const fd = new FormData(); fd.append('slip', file);
    const r = await api<Paid>(`/api/topup/${qr.topupId}/slip`, fd);
    setBusy(false);
    if (r.ok) onPaid(r.data); else setErr(r.error);
  }

  return (
    <>
      <div className="qr"><div className="qr-head">พร้อมเพย์ · PromptPay</div>
        <div className="qr-box" style={{ opacity: qLeft ? 1 : .2 }} dangerouslySetInnerHTML={{ __html: qr.qrSvg }} />
        <div className="qr-amt">{baht(qr.amount)}</div></div>
      {qLeft > 0
        ? <p className="timer">โอนภายใน <b className="num">{mm}:{String(ss).padStart(2, '0')}</b> นาที · ยอดต้องตรงตาม QR</p>
        : <p className="timer" style={{ color: 'var(--bad)' }}>QR หมดอายุ {sLeft > 0 ? `· โอนแล้วอัปสลิปได้อีก ${Math.ceil(sLeft / 60_000)} นาที` : ''} <button type="button" className="btn ghost sm" onClick={onRenew}>สร้าง QR ใหม่</button></p>}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(''); }} />
      <button type="button" className="drop" onClick={() => ref.current?.click()} style={{ width: '100%', font: 'inherit' }}>
        {file ? <>✅ <b>{file.name}</b><br /><span className="muted" style={{ fontSize: 13 }}>แตะเพื่อเปลี่ยนรูป</span></> : <>📎 <b>แตะเพื่อเลือกรูปสลิป</b><br /><span className="muted" style={{ fontSize: 13 }}>ระบบตรวจสลิปอัตโนมัติ ใช้เวลาไม่กี่วินาที</span></>}
      </button>
      <button type="button" className="btn primary lg block" style={{ marginTop: 14 }} disabled={busy || sLeft <= 0} onClick={send}>{busy ? 'กำลังตรวจสลิป…' : file ? 'ยืนยันสลิป' : 'เลือกรูปสลิป'}</button>
      {err && <p style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">{err}</p>}
    </>
  );
}
