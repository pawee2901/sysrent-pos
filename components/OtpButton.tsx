'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import type { OtpButton as Btn } from '@/lib/otp-button';

type Hit = { code: string | null; link: string | null; subject: string; date: string };
const time = (s: string) => new Date(s).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

/**
 * ปุ่ม "รับรหัส OTP" ของสินค้าที่ร้านเปิดไว้ — เปิดหน้าต่าง อีเมลของสินค้าใส่ให้แล้ว กดค้นหาได้เลย
 * ค้นผ่าน /api/otp (เช็กว่าเป็นอีเมลในสินค้าที่ยังไม่หมดอายุของลูกค้าคนนี้ + จำกัดจำนวนครั้ง)
 */
export function OtpButton({ otp, label }: { otp: Btn; label?: string }) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(otp.emails[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);

  async function search() {
    setBusy(true); setErr(''); setHits(null);
    const r = await api<{ hits: Hit[] }>('/api/otp', { account, appId: otp.appId });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    if (!r.data.hits.length) { setErr(`ยังไม่พบรหัสใน 15 นาทีล่าสุด — กดขอรหัสใน ${otp.appName} ก่อน แล้วกดค้นหาอีกครั้ง`); return; }
    setHits(r.data.hits);
  }
  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => notify('คัดลอกรหัสแล้ว'), () => {});
  }
  const close = () => { if (!busy) { setOpen(false); setHits(null); setErr(''); } };
  const h = hits?.[0];

  return (
    <>
      <button type="button" className="btn otp-btn" onClick={() => setOpen(true)}>🔐 {label ?? 'รับรหัส OTP'}</button>
      {open && (
        <div className="rd-bg" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="rd" role="dialog" aria-modal="true" aria-labelledby="otpb-title">
            <div className="rd-head">
              <div><h2 id="otpb-title">🔐 รับรหัส OTP</h2><span className="muted">{otp.appName}</span></div>
              <button type="button" className="icon-btn" onClick={close} disabled={busy} aria-label="ปิด">✕</button>
            </div>
            <div className="rd-body">
              <ol className="otpb-steps">
                <li>เข้าแอป <b>{otp.appName}</b> ด้วยอีเมลด้านล่าง แล้วกด <b>ส่งรหัสทางอีเมล</b></li>
                <li>กลับมากด <b>ค้นหารหัส</b> ภายใน 15 นาที</li>
                <li>นำรหัสที่ได้ไปกรอกในแอป แล้วใช้งานได้ตามปกติ</li>
              </ol>
              <label className="field"><span>อีเมลของสินค้า</span>
                {otp.emails.length > 1
                  ? <select className="input" value={account} onChange={(e) => { setAccount(e.target.value); setHits(null); }}>{otp.emails.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                  : <input className="input" value={account} readOnly />}
              </label>
              <button type="button" className="btn primary lg block" onClick={search} disabled={busy || !account}>{busy ? 'กำลังค้นหา…' : hits ? '🔍 ค้นหาอีกครั้ง' : '🔍 ค้นหารหัส'}</button>
              {err && <div className="otpf-err" role="alert">{err}</div>}
              {h && (
                <div className="otpf-result">
                  <span className="otpf-label">{h.code ? 'รหัสยืนยันตัวตน (OTP)' : 'ลิงก์ยืนยัน'} · ได้รับ {time(h.date)} น.</span>
                  {h.code && <button type="button" className="otpf-code" onClick={() => copy(h.code as string)} aria-label={`คัดลอกรหัส ${h.code}`}>{h.code}</button>}
                  {h.code && <button type="button" className="btn primary" onClick={() => copy(h.code as string)}>คัดลอกรหัส</button>}
                  {!h.code && h.link && <a className="btn primary" href={h.link} target="_blank" rel="noopener noreferrer">เปิดลิงก์ยืนยัน</a>}
                  <small className="muted">⏱️ รหัสมีอายุประมาณ 15 นาที หมดเวลาให้ขอรหัสใหม่ในแอปแล้วค้นหาอีกครั้ง</small>
                </div>
              )}
            </div>
            <div className="rd-foot"><button type="button" className="btn" onClick={close} disabled={busy}>ปิด</button></div>
          </div>
        </div>
      )}
    </>
  );
}
