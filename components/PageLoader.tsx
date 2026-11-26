'use client';
import { useEffect, useState } from 'react';
import { BUILTIN_LOADERS, LoaderArt } from '@/components/addons/AddonArt';

/** ตัวการ์ตูนโหลด (ใช้ทั้งหน้าร้านและตัวอย่างในหลังบ้าน) */
export function LoaderMark({ kind, logo }: { kind: string; logo?: string }) {
  if (BUILTIN_LOADERS[kind]) return <LoaderArt code={kind} size={110} label="กำลังโหลด" />;
  if (kind === 'dots') return <div className="pl-dots"><i /><i /><i /></div>;
  if (kind === 'heart') return <div className="pl-heart">💗</div>;
  if (kind === 'bar') return <div className="pl-bar"><i /></div>;
  if (kind === 'logo') return logo ? <img className="pl-logo" src={logo} alt="" /> : <div className="pl-heart">🛍️</div>;
  if (kind === 'logospin') return logo ? <img className="pl-logo pl-flip" src={logo} alt="" /> : <div className="pl-emo pl-flip">🛍️</div>;
  if (kind === 'logopulse') return <div className="pl-ripple pl-ripple-logo"><i /><i />{logo ? <img src={logo} alt="" /> : <b>🛍️</b>}</div>;
  if (kind === 'ring2') return <div className="pl-ring2" />;
  if (kind === 'grad') return <div className="pl-grad" />;
  if (kind === 'ripple') return <div className="pl-ripple"><i /><i /></div>;
  if (kind === 'orbit') return <div className="pl-orbit"><i /><i /><i /></div>;
  if (kind === 'eq') return <div className="pl-eq"><i /><i /><i /><i /><i /></div>;
  if (kind === 'cube') return <div className="pl-cube" />;
  if (kind === 'ball') return <div className="pl-ball"><i /><b /></div>;
  if (kind === 'text') return <div className="pl-text">กำลังโหลด<span>.</span><span>.</span><span>.</span></div>;
  const emo: Record<string, [string, string]> = { rocket: ['🚀', 'pl-float'], cart: ['🛒', 'pl-drive'], gift: ['🎁', 'pl-shake'], hourglass: ['⏳', 'pl-hour'], game: ['🎮', 'pl-bounce'], money: ['💸', 'pl-bounce'], star: ['⭐', 'pl-flip'] };
  if (emo[kind]) return <div className={`pl-emo ${emo[kind][1]}`}>{emo[kind][0]}</div>;
  return <div className="pl-spin" />;
}

/** หน้าจอรอโหลดตอนเปิดเว็บ — แสดงจาก HTML ทันที · ถ้า JavaScript พัง CSS จะซ่อนเองใน 3 วินาที ไม่ค้าง */
export function PageLoader({ kind, logo }: { kind: string; logo: string }) {
  const [gone, setGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGone(true), 500); return () => clearTimeout(t); }, []);
  if (kind === 'none' || gone) return null;
  return <div className="page-loader" aria-hidden="true"><LoaderMark kind={kind} logo={logo} /></div>;
}
