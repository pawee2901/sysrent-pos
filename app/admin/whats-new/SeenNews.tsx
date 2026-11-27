'use client';
import { useEffect } from 'react';
import { LATEST_NEWS } from '@/lib/whats-new';

/** เปิดหน้ามีอะไรใหม่แล้ว = อ่านแล้ว (จุดที่ปุ่มแถบบนหาย) */
export function SeenNews() {
  useEffect(() => {
    try { localStorage.setItem('admin-news-seen', LATEST_NEWS); } catch { /* โหมดส่วนตัว */ }
    window.dispatchEvent(new Event('admin-news-seen'));
  }, []);
  return null;
}
