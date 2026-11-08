'use client';
import { to } from '@/lib/routes';
import { useEffect, useState } from 'react';

/** ป๊อปอัปประกาศของร้าน — แสดงครั้งเดียวต่อการเปิดเว็บ (แก้ข้อความ / รูปใหม่ = แสดงอีกครั้ง) */
export function Popup({ shop, text, image, link }: { shop: string; text: string; image: string; link: string }) {
  const [open, setOpen] = useState(false);
  const key = `popup:${shop}`;
  const sig = `${text}|${image}|${link}`;
  useEffect(() => {
    try { if (sessionStorage.getItem(key) === sig) return; } catch { /* โหมดส่วนตัว */ }
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [key, sig]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  });
  function close() {
    setOpen(false);
    try { sessionStorage.setItem(key, sig); } catch { /* โหมดส่วนตัว */ }
  }
  if (!open) return null;
  const body = <>
    {image && <img src={image} alt="" className="popup-img" />}
    {text && <p className="popup-text">{text}</p>}
  </>;
  return (
    <div className="popup-bg" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="popup card" role="dialog" aria-modal="true" aria-label="ประกาศจากร้าน">
        <button type="button" className="icon-btn popup-x" onClick={close} aria-label="ปิด">✕</button>
        {link ? <a href={to(link)} onClick={close}>{body}</a> : body}
        <div className="popup-acts">
          {link && <a href={to(link)} className="btn primary block" onClick={close}>ดูเลย</a>}
          <button type="button" className={`btn ${link ? 'ghost' : 'primary'} block`} onClick={close}>ปิด</button>
        </div>
      </div>
    </div>
  );
}
