'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * หน้าต่างลอย (ป๊อปอัป) วางที่ระดับหน้าร้าน ไม่ใช่ในการ์ด
 * การ์ดแบบกระจก (backdrop-filter) ทำให้ position: fixed ของลูกติดอยู่ในการ์ด → ป๊อปอัปโดนบีบ/โดนตัด
 * วางใน .store (ไม่ใช่ body) เพื่อให้ยังได้สีของธีมร้าน
 */
export function Layer({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { setHost(document.querySelector('.store') ?? document.body); }, []);
  return host ? createPortal(children, host) : null;
}
