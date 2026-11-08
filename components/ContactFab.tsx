'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

/** ปุ่มลอย "ติดต่อเรา": ช่องทางเดียว = เปิดเลย · หลายช่องทาง = กดแล้วเลือก */
export function ContactFab({ line, facebook }: { line: string; facebook: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', click); window.removeEventListener('keydown', esc); };
  }, [open]);

  const channels = [line && { href: line, label: 'LINE', cls: 'line' }, facebook && { href: facebook, label: 'Facebook', cls: 'fb' }].filter(Boolean) as { href: string; label: string; cls: string }[];
  if (!channels.length) return null;
  const face = <><span className="contact-ic"><Icon name="chat" size={30} /></span><b>ติดต่อเรา</b></>;
  if (channels.length === 1) return <a className="contact-fab" href={channels[0].href} target="_blank" rel="noopener noreferrer" aria-label={`ติดต่อร้านทาง ${channels[0].label}`}>{face}</a>;
  return (
    <div className="contact-fab" ref={box}>
      {open && <div className="contact-pop" role="menu">{channels.map((c) => <a key={c.cls} role="menuitem" className={c.cls} href={c.href} target="_blank" rel="noopener noreferrer">{c.label}</a>)}</div>}
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{face}</button>
    </div>
  );
}
