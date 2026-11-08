'use client';
import { useEffect, useState } from 'react';

/** ตัวการ์ตูนโหลด (ใช้ทั้งหน้าร้านและตัวอย่างในหลังบ้าน) */
export function LoaderMark({ kind, logo }: { kind: string; logo?: string }) {
  if (kind === 'dots') return <div className="pl-dots"><i /><i /><i /></div>;
  if (kind === 'heart') return <div className="pl-heart">💗</div>;
  if (kind === 'bar') return <div className="pl-bar"><i /></div>;
  if (kind === 'logo') return logo ? <img className="pl-logo" src={logo} alt="" /> : <div className="pl-heart">🛍️</div>;
  return <div className="pl-spin" />;
}

/** หน้าจอรอโหลดตอนเปิดเว็บ — แสดงจาก HTML ทันที · ถ้า JavaScript พัง CSS จะซ่อนเองใน 3 วินาที ไม่ค้าง */
export function PageLoader({ kind, logo }: { kind: string; logo: string }) {
  const [gone, setGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGone(true), 500); return () => clearTimeout(t); }, []);
  if (kind === 'none' || gone) return null;
  return <div className="page-loader" aria-hidden="true"><LoaderMark kind={kind} logo={logo} /></div>;
}
