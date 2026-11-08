'use client';
import { useEffect, useRef, useState } from 'react';
import { parseMusic } from '@/lib/music';

/** การกดที่เบราว์เซอร์นับว่า "ผู้ใช้ตั้งใจ" (เปิดเสียงได้) — pointerdown บน iPhone ไม่นับ จึงใช้ pointerup/touchend/click */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

/**
 * ปุ่มเพลงลอยมุมจอ (ฟังก์ชันเสริม) — เปิดเพลงเองให้มากที่สุดเท่าที่เบราว์เซอร์ยอม:
 * 1) ไฟล์เสียง: ลองเล่นทันทีที่เปิดหน้า (บางเบราว์เซอร์อนุญาต)
 * 2) ไม่ได้ (เบราว์เซอร์ส่วนใหญ่ห้ามเปิดเสียงก่อนผู้ใช้แตะหน้า) → เล่นทันทีเมื่อลูกค้าแตะตรงไหนก็ได้ครั้งแรก เช่น กดเลือกแอป
 * ลูกค้ากดหยุดเองแล้ว จะไม่เปิดเองอีก · YouTube: สร้าง iframe ตอนเริ่มเล่น แล้วสั่งเล่น/หยุดผ่าน postMessage
 */
export function MusicPlayer({ url, title }: { url: string; title?: string }) {
  const m = parseMusic(url);
  const [on, setOn] = useState(false);
  const [started, setStarted] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const yt = useRef<HTMLIFrameElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const userStopped = useRef(false);
  const kind = m?.kind;

  useEffect(() => () => { audio.current?.pause(); }, []);

  // เปิดเพลงเอง: ลองทันที แล้วรอแตะครั้งแรก (ยกเว้นแตะปุ่มเพลง — ปุ่มจัดการเอง)
  useEffect(() => {
    if (!kind) return;
    let done = false;
    const start = () => {
      if (done || userStopped.current) return;
      if (kind === 'audio') {
        const a = audio.current;
        if (!a) return;
        a.play().then(() => { done = true; setOn(true); remove(); }).catch(() => {});
      } else {
        done = true; setStarted(true); setOn(true); remove();   // iframe โหลดพร้อม autoplay (มีการแตะแล้ว เบราว์เซอร์ยอม)
      }
    };
    const onGesture = (e: Event) => {
      if (fab.current && e.target instanceof Node && fab.current.contains(e.target)) return;
      start();
    };
    const remove = () => GESTURES.forEach((g) => window.removeEventListener(g, onGesture, true));
    GESTURES.forEach((g) => window.addEventListener(g, onGesture, true));
    if (kind === 'audio') start();   // YouTube ต้องรอแตะก่อน (เปิดก่อนแตะ เบราว์เซอร์ให้เล่นแบบไม่มีเสียงเท่านั้น)
    return remove;
  }, [kind]);

  if (!m) return null;

  const ytCmd = (func: 'playVideo' | 'pauseVideo') =>
    yt.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');

  function toggle() {
    if (!m) return;
    userStopped.current = on;   // กดหยุดเอง = ไม่เปิดเองอีก
    if (m.kind === 'audio') {
      const a = audio.current;
      if (!a) return;
      if (a.paused) { a.play().then(() => setOn(true)).catch(() => setOn(false)); } else { a.pause(); setOn(false); }
      return;
    }
    if (!started) { setStarted(true); setOn(true); return; }   // iframe โหลดพร้อม autoplay
    ytCmd(on ? 'pauseVideo' : 'playVideo'); setOn(!on);
  }

  return (
    <>
      {m.kind === 'audio' && <audio ref={audio} src={m.url} loop preload="auto" onPause={() => setOn(false)} onPlay={() => setOn(true)} />}
      {m.kind === 'youtube' && started && (
        <iframe ref={yt} title="เพลงประกอบร้าน" allow="autoplay; encrypted-media"
          src={`https://www.youtube-nocookie.com/embed/${m.id}?autoplay=1&loop=1&playlist=${m.id}&controls=0&enablejsapi=1&playsinline=1`}
          style={{ position: 'fixed', width: 1, height: 1, left: -10, bottom: -10, opacity: 0, pointerEvents: 'none', border: 0 }} />
      )}
      <button ref={fab} type="button" className={`music-fab${on ? ' on' : ''}`} onClick={toggle} aria-pressed={on} aria-label={on ? 'หยุดเพลง' : 'เปิดเพลง'}>
        <span className="music-disc" aria-hidden="true">{on ? '♫' : '♪'}</span>
        <span className="music-txt">{on ? (title || 'กำลังเล่นเพลง') : 'เปิดเพลง'}</span>
        {on && <span className="music-bars" aria-hidden="true"><i /><i /><i /></span>}
      </button>
    </>
  );
}
