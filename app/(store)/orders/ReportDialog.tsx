'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/components/Cart';
import { REPORT_TOPICS } from '@/lib/reports';

const ICON: Record<string, string> = {
  'เข้าใช้งานไม่ได้ / รหัสผิด': '🔐', 'โดนเปลี่ยนรหัส / โดนเตะออก': '🚪', 'จอเต็ม / โปรไฟล์ถูกใช้': '🖥️', 'ยังไม่ได้รับสินค้า': '📦', 'อื่น ๆ': '💬',
};

/** กล่องแจ้งปัญหา: เลือกเรื่อง · เขียนรายละเอียด · แนบรูป (ไม่บังคับ) → ส่งให้ร้าน */
export function ReportDialog({ code, onClose, onSent }: { code: string; onClose: () => void; onSent: () => void }) {
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pickRef = useRef<HTMLInputElement>(null);
  // วาดที่ระดับหน้าเว็บ (ใน .store ให้ได้สีธีม) — ถ้าอยู่ในการ์ดที่มี backdrop-filter / transform กล่องจะติดอยู่ในการ์ด
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(document.querySelector('.store') ?? document.body), []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [busy, onClose]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('แนบได้เฉพาะรูปภาพ'); return; }
    if (f.size > 8 * 1024 * 1024) { setErr('รูปใหญ่เกิน 8MB'); return; }
    setErr(''); setFile(f); setPreview(URL.createObjectURL(f));
  }
  async function send() {
    if (!topic) { setErr('กรุณาเลือกเรื่องที่พบ'); return; }
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.append('code', code); fd.append('topic', topic); fd.append('message', message.trim());
    if (file) fd.append('image', file);
    const r = await api('/api/reports', fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    onSent();
  }

  if (!host) return null;
  return createPortal(
    <div className="rd-bg" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="rd" role="dialog" aria-modal="true" aria-labelledby="rd-title">
        <div className="rd-head">
          <div><h2 id="rd-title">แจ้งปัญหา</h2><span className="muted">ออเดอร์ <b className="num">{code}</b> · ร้านจะตอบกลับในหน้าประวัติ</span></div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="ปิด">✕</button>
        </div>

        <div className="rd-body">
          <div className="rd-label">1. เลือกเรื่องที่พบ</div>
          <div className="rd-topics" role="radiogroup">
            {REPORT_TOPICS.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={topic === t} className={`rd-topic${topic === t ? ' on' : ''}`} onClick={() => { setTopic(t); setErr(''); }}>
                <i>{ICON[t] ?? '•'}</i><span>{t}</span>
              </button>
            ))}
          </div>

          <label className="rd-label" htmlFor="rd-msg">2. อธิบายเพิ่มเติม <span className="muted">(ไม่บังคับ)</span></label>
          <textarea id="rd-msg" className="input rd-msg" rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="เช่น เข้าแอปแล้วขึ้นว่ารหัสผ่านไม่ถูกต้อง ตั้งแต่เมื่อคืน 3 ทุ่ม ลองแล้วทั้งมือถือและทีวี" />
          <div className="rd-count muted">{message.length}/1000</div>

          <div className="rd-label">3. แนบรูป <span className="muted">(ไม่บังคับ · เช่น ภาพหน้าจอที่ขึ้น error)</span></div>
          <input ref={pickRef} type="file" accept="image/*" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
          {preview ? (
            <div className="rd-preview">
              <img src={preview} alt="รูปที่แนบ" />
              <div className="rd-preview-acts">
                <button type="button" className="btn sm" onClick={() => pickRef.current?.click()}>เปลี่ยนรูป</button>
                <button type="button" className="btn ghost sm" onClick={() => { setFile(null); setPreview(''); }}>เอาออก</button>
              </div>
            </div>
          ) : (
            <button type="button" className="rd-drop" onClick={() => pickRef.current?.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files?.[0]); }}>
              <span>🖼️</span><b>แตะเพื่อเลือกรูป</b><small className="muted">หรือลากรูปมาวางตรงนี้ · ไม่เกิน 8MB</small>
            </button>
          )}
          {err && <p className="rd-err" role="alert">{err}</p>}
        </div>

        <div className="rd-foot">
          <button type="button" className="btn lg" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button type="button" className="btn primary lg" onClick={send} disabled={busy || !topic}>{busy ? 'กำลังส่ง…' : 'ส่งเรื่องให้ร้าน'}</button>
        </div>
      </div>
    </div>,
    host,
  );
}
