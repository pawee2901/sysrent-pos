'use client';
import { useEffect, useState } from 'react';

type P = { id: number; x: number; dur: number; delay: number; size: number; drift: number; ch: string; color: string };
const CH: Record<string, string[]> = { hearts: ['💗', '💖', '💕'], sakura: ['🌸', '💮'], snow: ['❄', '❅', '❆'], stars: ['✨', '⭐', '🌟'], lantern: ['🏮'], bubbles: [''] };
const COLORS = ['var(--accent)', 'var(--accent-2)', '#fbbf24', '#34d399', '#60a5fa', '#f472b6'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** เอฟเฟกต์ลอยทั้งหน้า (ไม่บังการกด) — สุ่มหลังโหลดหน้า กัน HTML ฝั่งเซิร์ฟเวอร์ไม่ตรงกับเบราว์เซอร์ · contained = กรอบตัวอย่างในหลังบ้าน */
export function FloatingFx({ effect, contained = false }: { effect: string; contained?: boolean }) {
  const [items, setItems] = useState<P[]>([]);
  useEffect(() => {
    if (effect === 'none' || (!contained && matchMedia('(prefers-reduced-motion: reduce)').matches)) { setItems([]); return; }
    const n = contained ? 10 : window.innerWidth < 640 ? 14 : 24;
    setItems(Array.from({ length: n }, (_, id) => ({
      id, x: Math.random() * 100, dur: 7 + Math.random() * 8, delay: -Math.random() * 15, size: 0.7 + Math.random() * 0.8, drift: (Math.random() - 0.5) * 120,
      ch: pick(CH[effect] ?? ['']), color: pick(COLORS),
    })));
  }, [effect, contained]);
  if (!items.length) return null;
  const rise = effect === 'lantern' || effect === 'bubbles';
  return (
    <div className={`fx${contained ? ' contained' : ''} fx-${effect}`} aria-hidden="true">
      {items.map((p) => (
        <span key={p.id} className={rise ? 'fx-rise' : 'fx-fall'} style={{ left: `${p.x}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, fontSize: `${p.size * 20}px`, ['--drift' as string]: `${p.drift}px`, ['--c' as string]: p.color }}>{p.ch}</span>
      ))}
    </div>
  );
}
