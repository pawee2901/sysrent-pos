'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import { shrinkForUpload } from '@/components/upload';

type Qr = { id: string; amount: number; expiresAt: string; qrSvg: string };
const PRESETS = [50, 100, 200, 500];
const money = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

/**
 * เติมเงินกระเป๋า SysRent (จ่ายค่าตรวจสลิป) ในหลังบ้านร้านเลย: เลือกยอด → สแกน QR พร้อมเพย์ → อัปสลิป → เงินเข้าทันที
 * ไม่ต้องออกไปเว็บหลัก (เว็บเช่าเป็นคนสร้าง QR / ตรวจสลิปให้เบื้องหลัง)
 */
export function WalletTopup({ label = 'เติมเงิน', className = 'btn sm', style }: { label?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('100');
  const [qr, setQr] = useState<Qr | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!qr) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(qr.expiresAt).getTime() - Date.now()) / 1000)));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [qr]);
  const close = () => { if (busy) return; setOpen(false); setQr(null); setErr(''); setDone(null); };

  async function create() {
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 10) { setErr('เติมขั้นต่ำ ฿10 (จำนวนเต็ม)'); return; }
    setBusy(true); setErr('');
    const r = await api<Qr>('/api/admin/sysrent-wallet', { action: 'create', amount: n });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setQr(r.data);
  }
  async function sendSlip(fl?: File) {
    if (!fl || !qr) return;
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.set('id', qr.id);
    const blob = await shrinkForUpload(fl, 1600);
    fd.set('slip', blob, 'slip.' + (blob.type.split('/')[1] || 'jpg'));
    const r = await api<{ balance: number }>('/api/admin/sysrent-wallet', fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setDone(r.data.balance); notify('เติมเงินเข้ากระเป๋า SysRent แล้ว ✓'); router.refresh();
  }

  const modal = open && (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,17,23,.45)', display: 'grid', placeItems: 'center', padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-label="เติมเงินกระเป๋า SysRent" style={{ width: 'min(420px, 100%)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', background: 'var(--surface)', color: 'var(--text)', borderRadius: 22, boxShadow: '0 24px 60px rgba(0,0,0,.3)', padding: 20, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, display: 'grid' }}><b style={{ fontSize: 17 }}>💳 เติมเงินกระเป๋า SysRent</b><small className="muted">ใช้จ่ายค่าตรวจสลิป ฿0.30/ใบ · เงินเข้าทันทีหลังตรวจสลิป</small></div>
          <button type="button" className="icon-btn" onClick={close} aria-label="ปิด" disabled={busy}>✕</button>
        </div>
        {done !== null ? (
          <div style={{ display: 'grid', gap: 10, justifyItems: 'center', textAlign: 'center', padding: '10px 0' }}>
            <span style={{ fontSize: 44 }}>✅</span><b style={{ fontSize: 18 }}>เติมเงินสำเร็จ</b>
            <span className="muted">ยอดกระเป๋าตอนนี้ <b style={{ color: 'var(--text)' }}>{money(done)}</b></span>
            <button type="button" className="btn primary" onClick={close}>เสร็จแล้ว</button>
          </div>
        ) : !qr ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>{PRESETS.map((n) => (
              <button key={n} type="button" onClick={() => setAmount(String(n))} style={{ height: 44, borderRadius: 12, font: 'inherit', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${amount === String(n) ? 'var(--accent)' : 'var(--line)'}`, background: amount === String(n) ? 'var(--accent-soft)' : 'var(--surface)', color: amount === String(n) ? 'var(--accent)' : 'var(--text)' }}>฿{n}</button>))}</div>
            <label className="field"><span>หรือใส่จำนวนเอง (บาท)</span><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))} /></label>
            <small className="faint">฿{amount || 0} ตรวจสลิปได้ประมาณ {Math.floor(Number(amount || 0) / 0.3).toLocaleString('th-TH')} ใบ</small>
            {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
            <button type="button" className="btn primary" disabled={busy || !amount} onClick={create}>{busy ? 'กำลังสร้าง QR…' : `สร้าง QR เติม ฿${amount || 0}`}</button>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 6, textAlign: 'center' }}>
              <span className="muted" style={{ fontSize: 13 }}>สแกนจ่ายพร้อมเพย์ ยอด</span>
              <b style={{ fontSize: 30, fontFamily: 'var(--font-head)' }}>{money(qr.amount)}</b>
              <div style={{ width: 230, maxWidth: '100%', background: '#fff', borderRadius: 16, padding: 10 }} dangerouslySetInnerHTML={{ __html: qr.qrSvg }} />
              <small style={{ color: left < 60 ? 'var(--bad)' : 'var(--muted)' }}>{left > 0 ? `QR หมดอายุใน ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} นาที · โอนยอดนี้พอดี` : 'QR หมดอายุแล้ว (อัปสลิปที่โอนทันเวลาได้อีก 10 นาที)'}</small>
            </div>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { sendSlip(e.target.files?.[0]); e.target.value = ''; }} />
            {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
            <button type="button" className="btn primary" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'กำลังตรวจสลิป…' : '📎 อัปโหลดสลิปที่โอนแล้ว'}</button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => { setQr(null); setErr(''); }}>← เปลี่ยนยอด</button>
          </>
        )}
      </div>
    </div>
  );
  return (
    <>
      <button type="button" className={className} style={style} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>{label}</button>
      {modal && typeof document !== 'undefined' && createPortal(modal, document.body)}
    </>
  );
}
