'use client';
import { useEffect, useRef } from 'react';

type Api = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id: string) => void; remove: (id: string) => void };
declare global { interface Window { turnstile?: Api } }

const KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const humanCheckOn = !!KEY;

let loading: Promise<void> | null = null;
function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = SRC; s.async = true; s.onload = () => ok(); s.onerror = () => { loading = null; no(new Error('turnstile')); };
    document.head.appendChild(s);
  });
  return loading;
}

/** กล่องยืนยันว่าเป็นมนุษย์ · เปลี่ยน nonce เพื่อขอ token ใหม่หลังส่งฟอร์มไม่ผ่าน */
export function HumanCheck({ onToken, nonce }: { onToken: (t: string) => void; nonce: number }) {
  const box = useRef<HTMLDivElement>(null), id = useRef<string | null>(null), cb = useRef(onToken);
  useEffect(() => { cb.current = onToken; }, [onToken]);
  useEffect(() => {
    if (!KEY) return;
    let gone = false;
    load().then(() => {
      if (gone || !box.current || !window.turnstile) return;
      id.current = window.turnstile.render(box.current, {
        sitekey: KEY, language: 'th', theme: 'auto',
        callback: (t: string) => cb.current(t), 'expired-callback': () => cb.current(''), 'error-callback': () => cb.current(''),
      });
    }).catch(() => cb.current(''));
    return () => { gone = true; if (id.current && window.turnstile) window.turnstile.remove(id.current); id.current = null; };
  }, []);
  useEffect(() => {
    if (nonce && id.current && window.turnstile) { window.turnstile.reset(id.current); cb.current(''); }
  }, [nonce]);
  return KEY ? <div ref={box} style={{ minHeight: 65 }} /> : null;
}
