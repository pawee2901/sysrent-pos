'use client';
import { useEffect, useRef, useState } from 'react';
import { api, baht } from '@/components/Cart';

export type Qr = { topupId: string; amount: number; expiresAt: string; deadline: string; qrSvg: string; auto?: boolean; slip?: boolean };
export type Paid = { amount: number; balance?: number; order?: string; orderError?: string };

const left = (iso: string) => Math.max(0, new Date(iso).getTime() - Date.now());

/** QR พร้อมเพย์ของร้าน + นับถอยหลัง · เงินเข้าอัตโนมัติ (ระบบเช็คเงินเข้าเอง) และ/หรือ อัปสลิป (SlipOK) */
export function PromptPayPanel({ qr, onPaid, onRenew }: { qr: Qr; onPaid: (p: Paid) => void; onRenew: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  void now;
  const qLeft = left(qr.expiresAt), sLeft = left(qr.deadline);
  const mm = Math.floor(qLeft / 60_000), ss = Math.floor((qLeft % 60_000) / 1000);
  const slip = qr.slip ?? true;
  const done = useRef(false);
  const paidCb = useRef(onPaid);
  paidCb.current = onPaid;

  // เงินเข้าอัตโนมัติ: ถามสถานะทุก 4 วินาที จนกว่าเงินเข้า / เลยเวลา
  useEffect(() => {
    if (!qr.auto) return;
    const t = setInterval(async () => {
      if (done.current || left(qr.deadline) <= 0) return;
      const r = await api<Paid & { status: string }>(`/api/topup/${qr.topupId}`, undefined, 'GET');
      if (r.ok && r.data.status === 'paid' && !done.current) { done.current = true; paidCb.current(r.data); }
    }, 4000);
    return () => clearInterval(t);
  }, [qr.auto, qr.topupId, qr.deadline]);

  async function send() {
    if (!file) { ref.current?.click(); return; }
    setBusy(true); setErr('');
    const fd = new FormData(); fd.append('slip', file);
    const r = await api<Paid & { waiting?: boolean; message?: string }>(`/api/topup/${qr.topupId}/slip`, fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    // สลิปถูกต้องแต่เงินยังไม่เข้า → รอ (หน้านี้ถามสถานะต่อเอง เงินเข้าแล้วเปลี่ยนหน้าให้)
    if (r.data.waiting) { setNote(r.data.message ?? 'สลิปถูกต้อง รอเงินเข้าสักครู่'); setFile(null); return; }
    if (!done.current) { done.current = true; onPaid(r.data); }
  }

  return (
    <>
      <div className="qr"><div className="qr-head">พร้อมเพย์ · PromptPay</div>
        <div className="qr-box" style={{ opacity: qLeft ? 1 : .2 }} dangerouslySetInnerHTML={{ __html: qr.qrSvg }} />
        <div className="qr-amt">{baht(qr.amount)}</div></div>
      {qr.auto && <p className="qr-exact">โอน <b className="num">฿{qr.amount.toFixed(2)}</b> ให้ตรงทุกสตางค์<br /><span className="muted">เศษสตางค์คือรหัสของคุณ ระบบใช้จับคู่เงินเข้า · เศษเข้ากระเป๋าคุณ ไม่หาย</span></p>}
      {qLeft > 0
        ? <p className="timer">โอนภายใน <b className="num">{mm}:{String(ss).padStart(2, '0')}</b> นาที · ยอดต้องตรงตาม QR</p>
        : <p className="timer" style={{ color: 'var(--bad)' }}>QR หมดอายุ {qr.auto ? '· ถ้าโอนไปแล้ว เงินจะเข้ากระเป๋าเองเมื่อระบบเห็นเงินเข้า' : sLeft > 0 && slip ? `· โอนแล้วอัปสลิปได้อีก ${Math.ceil(sLeft / 60_000)} นาที` : ''} <button type="button" className="btn ghost sm" onClick={onRenew}>สร้าง QR ใหม่</button></p>}
      {qr.auto && sLeft > 0 && <div className="auto-wait"><span className="live-dot" />โอนแล้วรอสักครู่ ระบบตรวจเงินเข้าให้เอง ไม่ต้องกดอะไร</div>}
      {!qr.auto && !slip && <p className="muted" style={{ textAlign: 'center' }}>โอนแล้วส่งสลิปให้ร้านทาง LINE ร้านจะเติมเงินให้</p>}
      {slip && <>
      {qr.auto && <p className="muted" style={{ textAlign: 'center', fontSize: 13, margin: '14px 0 6px' }}>ผ่านไป 2–3 นาทีแล้วยังไม่เข้า? อัปสลิปได้</p>}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(''); }} />
      <button type="button" className="drop" onClick={() => ref.current?.click()} style={{ width: '100%', font: 'inherit' }}>
        {file ? <>✅ <b>{file.name}</b><br /><span className="muted" style={{ fontSize: 13 }}>แตะเพื่อเปลี่ยนรูป</span></> : <>📎 <b>แตะเพื่อเลือกรูปสลิป</b><br /><span className="muted" style={{ fontSize: 13 }}>ระบบตรวจสลิปอัตโนมัติ ใช้รูปสลิปเต็มใบที่เห็น QR</span></>}
      </button>
      <button type="button" className="btn primary lg block" style={{ marginTop: 14 }} disabled={busy || sLeft <= 0} onClick={send}>{busy ? 'กำลังตรวจสลิป…' : file ? 'ยืนยันสลิป' : 'เลือกรูปสลิป'}</button>
      </>}
      {note && <p className="auto-wait" style={{ marginTop: 10 }} role="status">{note}</p>}
      {err && <p style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">{err}</p>}
    </>
  );
}
