'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { to } from '@/lib/routes';
import css from './nav.module.css';

/** ทางลัดที่ค้นได้: เมนู + แท็บในหน้าตั้งค่า + คำที่คนมักพิมพ์หา */
export type Hit = { href: string; label: string; where: string; words?: string };
const SETTINGS: Hit[] = [
  { href: '/settings#shop', label: 'ข้อมูลร้าน', where: 'ตั้งค่า', words: 'ชื่อร้าน โลโก้ คำโปรย ประกาศ ช่องทางติดต่อ line facebook ลิงก์ติดต่อ เบอร์' },
  { href: '/settings#look', label: 'หน้าตาร้าน', where: 'ตั้งค่า', words: 'ธีม สี ฟอนต์ เอฟเฟกต์ เพลง พื้นหลัง การ์ด ความมน theme' },
  { href: '/settings#layout', label: 'จัดหน้าร้าน', where: 'ตั้งค่า', words: 'กล่อง ลากวาง แม่แบบ หน้าเพิ่ม page builder feed เมนูหน้า' },
  { href: '/settings#home', label: 'รูปหน้าแรก · ป๊อปอัป', where: 'ตั้งค่า', words: 'แบนเนอร์ banner popup โปรโมชัน การ์ดโปร' },
  { href: '/settings#pay', label: 'รับเงิน', where: 'ตั้งค่า', words: 'พร้อมเพย์ promptpay บัญชีรับเงิน ชื่อบัญชี qr' },
  { href: '/settings#notify', label: 'แจ้งเตือน', where: 'ตั้งค่า', words: 'discord อีเมล smtp แอป push แจ้งเตือนลูกค้า ติดตั้งแอป' },
  { href: '/settings#admin', label: 'บัญชีหลังบ้าน', where: 'ตั้งค่า', words: 'รหัสผ่าน password ชื่อผู้ใช้ เปลี่ยนรหัส' },
];
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** ช่องค้นหาที่แถบบน (Ctrl / ⌘ + K) */
export function NavSearch({ menu }: { menu: Hit[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const inp = useRef<HTMLInputElement>(null);
  const all = useMemo(() => [...menu, ...(menu.some((m) => m.href === '/settings') ? SETTINGS : [])], [menu]);
  const hits = useMemo(() => {
    const k = norm(q);
    if (!k) return all.slice(0, 8);
    return all.filter((h) => norm(`${h.label} ${h.where} ${h.words ?? ''}`).includes(k)).slice(0, 8);
  }, [q, all]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); setTimeout(() => inp.current?.focus(), 0); } };
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down); };
  }, []);
  useEffect(() => setSel(0), [q]);

  function go(h: Hit) {
    setOpen(false); setQ(''); inp.current?.blur();
    const [path, hash] = h.href.split('#');
    const url = to(`/admin${path}`);
    // หน้าเดิม เปลี่ยนแค่แท็บ (#) → ตั้ง hash ตรง ๆ ให้หน้าตั้งค่าสลับแท็บ
    if (hash && window.location.pathname === url) { window.location.hash = hash; return; }
    router.push(hash ? `${url}#${hash}` : url);
  }

  return (
    <div className={`${css.search}${open ? ` ${css.open}` : ''}`} ref={box}>
      <button type="button" className={css.sbtn} aria-label="ค้นหาเมนู" onClick={() => { setOpen(true); setTimeout(() => inp.current?.focus(), 0); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>
      <input ref={inp} className={css.sinput} value={q} placeholder="ค้นหาเมนู / การตั้งค่า…" aria-label="ค้นหาเมนูและการตั้งค่า"
        onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
          else if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); go(hits[sel]); }
          else if (e.key === 'Escape') { setOpen(false); inp.current?.blur(); }
        }} />
      <kbd className={css.kbd}>Ctrl K</kbd>
      {open && (
        <div className={css.drop} role="listbox">
          {hits.length ? hits.map((h, i) => (
            <button key={h.href} type="button" role="option" aria-selected={i === sel} className={i === sel ? css.on : ''} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
              <b>{h.label}</b><small>{h.where}</small>
            </button>
          )) : <p className={css.none}>ไม่พบ “{q}”</p>}
        </div>
      )}
    </div>
  );
}
