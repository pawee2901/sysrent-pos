'use client';
import { useEffect, useState } from 'react';

type P = { id: number; x: number; dur: number; delay: number; size: number; drift: number; ch: string; color: string };
const CH: Record<string, string[]> = {
  hearts: ['💗', '💖', '💕'], sakura: ['🌸', '💮'], snow: ['❄', '❅', '❆'], stars: ['✨', '⭐', '🌟'], lantern: ['🏮'], bubbles: [''],
  flowers: ['🌼', '🌷', '🌺', '🌻'], butterfly: ['🦋'], balloons: ['🎈'], sweets: ['🍬', '🍭', '🍩', '🧁', '🍪'], paws: ['🐾'], teddy: ['🧸', '💝'],
  gifts: ['🎁', '🎀'], lotus: ['🪷'], spooky: ['🎃', '👻', '🦇'], leaves: ['🍁', '🍂', '🍃'], rain: [''], clover: ['🍀', '☘️'],
  money: ['💸', '💵', '💰'], coins: ['🪙'], gems: ['💎'], percent: ['%', '%', 'SALE'], fire: ['🔥'],
  glitter: ['✦', '✧', '✦'], fireflies: [''], embers: [''], matrix: ['0', '1', '0', '1', 'ア', 'カ'], game: ['🎮', '👾', '🕹️', '⭐'], rocket: ['🚀'], music: ['🎵', '🎶'],
};
/** ลอยขึ้นจากล่าง */
const RISE = new Set(['lantern', 'bubbles', 'balloons', 'butterfly', 'lotus', 'fire', 'fireflies', 'embers', 'rocket', 'music']);
/** ไม่หมุนระหว่างลอย · ความเร็ว (คูณระยะเวลา: น้อย = เร็ว) */
const STRAIGHT = new Set(['rain', 'matrix', 'balloons', 'lantern', 'rocket', 'fire', 'lotus']);
const SPEED: Record<string, number> = { rain: 0.18, matrix: 0.45, fireflies: 1.4, embers: 0.7 };
const COLORS = ['var(--accent)', 'var(--accent-2)', '#fbbf24', '#34d399', '#60a5fa', '#f472b6'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** เอฟเฟกต์ลอยทั้งหน้า (ไม่บังการกด) — สุ่มหลังโหลดหน้า กัน HTML ฝั่งเซิร์ฟเวอร์ไม่ตรงกับเบราว์เซอร์ · contained = กรอบตัวอย่างในหลังบ้าน */
export function FloatingFx({ effect, contained = false }: { effect: string; contained?: boolean }) {
  const [items, setItems] = useState<P[]>([]);
  useEffect(() => {
    if (effect === 'none' || (!contained && matchMedia('(prefers-reduced-motion: reduce)').matches)) { setItems([]); return; }
    const n = (contained ? 10 : window.innerWidth < 640 ? 14 : 24) * (effect === 'rain' || effect === 'matrix' ? 2 : 1);
    setItems(Array.from({ length: n }, (_, id) => ({
      id, x: Math.random() * 100, dur: (7 + Math.random() * 8) * (SPEED[effect] ?? 1), delay: -Math.random() * 15 * (SPEED[effect] ?? 1), size: 0.7 + Math.random() * 0.8, drift: effect === 'rain' || effect === 'matrix' ? 0 : (Math.random() - 0.5) * 120,
      ch: pick(CH[effect] ?? ['']), color: pick(COLORS),
    })));
  }, [effect, contained]);
  if (!items.length) return null;
  const cls = `${RISE.has(effect) ? 'fx-rise' : 'fx-fall'}${STRAIGHT.has(effect) ? ' fx-straight' : ''}`;
  return (
    <div className={`fx${contained ? ' contained' : ''} fx-${effect}`} aria-hidden="true">
      {items.map((p) => (
        <span key={p.id} className={cls} style={{ left: `${p.x}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, fontSize: `${p.size * 20}px`, ['--drift' as string]: `${p.drift}px`, ['--c' as string]: p.color }}>{p.ch}</span>
      ))}
    </div>
  );
}
