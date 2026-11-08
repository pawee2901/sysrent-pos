'use client';
import { useState } from 'react';

/** ปุ่มดาวน์โหลดรูป (เซฟลงเครื่องจริง ไม่ใช่แค่เปิดแท็บใหม่) · ดึงไม่ได้ = เปิดรูปในแท็บใหม่ให้กดค้างเซฟเอง */
export function DownloadImage({ src, name }: { src: string; name: string }) {
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const r = await fetch(src, { mode: 'cors' });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'วิธีใช้งาน'}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      window.open(src, '_blank', 'noopener');
    }
    setBusy(false);
  }
  return <button type="button" className="copy-btn dl-btn" disabled={busy} onClick={save}>{busy ? 'กำลังดาวน์โหลด…' : '⬇ ดาวน์โหลดรูป'}</button>;
}
