'use client';
import { useEffect, useState } from 'react';

/** เวลาที่ร้านตั้ง (YYYY-MM-DDTHH:mm เวลาไทย) → มิลลิวินาที */
export const untilMs = (until: string | undefined) => (until ? new Date(`${until}:00+07:00`).getTime() : NaN);
/** แยกเวลาที่เหลือเป็น วัน ชม. นาที วินาที */
export function splitLeft(ms: number): [number, number, number, number] {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
}

/** กล่องโค้ดส่วนลด: กดคัดลอกโค้ด */
export function CouponBox({ title, code, text }: { title?: string; code: string; text?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* ไม่มีสิทธิ์คลิปบอร์ด */ }
  }
  return (
    <div className="hb hb-coupon">
      <div>{title && <b>{title}</b>}{text && <span>{text}</span>}</div>
      <button type="button" className="hb-code" onClick={copy} aria-label={`คัดลอกโค้ด ${code}`}><span>{code}</span><small>{done ? 'คัดลอกแล้ว ✓' : 'แตะเพื่อคัดลอก'}</small></button>
    </div>
  );
}

/** นับถอยหลังถึงวันหมดโปร (หมดเวลาแล้ว = ซ่อนตัวเลข) */
export function Countdown({ title, until, tone = 'dark', label, link }: { title?: string; until: string; tone?: string; label?: string; link?: string }) {
  const end = untilMs(until);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!Number.isFinite(end)) return null;
  const left = now === null ? null : end - now;
  const parts = splitLeft(left ?? 0);
  return (
    <div className={`hb hb-count ${tone}`}>
      {title && <b>{left !== null && left <= 0 ? 'โปรนี้หมดเวลาแล้ว' : title}</b>}
      {(left === null || left > 0) && (
        <div className="hb-count-n" aria-live="off">{(['วัน', 'ชม.', 'นาที', 'วิ'] as const).map((u, i) => (
          <span key={u}><b className="num">{left === null ? '–' : String(parts[i]).padStart(2, '0')}</b><small>{u}</small></span>))}</div>
      )}
      {label && link && <a href={link} className="btn lg">{label}</a>}
    </div>
  );
}
