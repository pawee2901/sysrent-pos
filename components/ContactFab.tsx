'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { CONTACT_KINDS, contactHref, type ContactLink } from '@/lib/contacts';

/** ปุ่มลอย "ติดต่อเรา": ช่องทางเดียว = เปิดเลย · หลายช่องทาง = กดแล้วเลือก (ชื่อปุ่ม + คำอธิบาย) */
export function ContactFab({ links }: { links: ContactLink[] }) {
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

  if (!links.length) return null;
  const ext = (c: ContactLink) => (c.kind === 'phone' || c.kind === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' });
  const face = <><span className="contact-ic"><Icon name="chat" size={30} /></span><b>ติดต่อเรา</b></>;
  if (links.length === 1) {
    const c = links[0];
    return <a className="contact-fab" href={contactHref(c)} {...ext(c)} aria-label={`ติดต่อร้านทาง ${c.label || CONTACT_KINDS[c.kind].label}`}>{face}</a>;
  }
  return (
    <div className="contact-fab" ref={box}>
      {open && (
        <div className="contact-pop" role="menu">
          <small className="contact-pop-h">ติดต่อร้านได้ทาง</small>
          {links.map((c, i) => {
            const k = CONTACT_KINDS[c.kind];
            return (
              <a key={i} role="menuitem" href={contactHref(c)} {...ext(c)} className="contact-row">
                <span className="contact-row-ic" style={{ background: k.color }}>{k.short}</span>
                <span className="contact-row-t"><b>{c.label || k.label}</b>{c.note && <small>{c.note}</small>}</span>
              </a>
            );
          })}
        </div>
      )}
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{face}</button>
    </div>
  );
}
