'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';

/** ส่งแจ้งเตือนถึงลูกค้าทุกคนที่เปิดรับในแอปร้าน (โปรโมชัน / ข่าวร้าน) */
export function PushCard({ init }: { init: { ready: boolean; devices: number } }) {
  const [f, setF] = useState({ title: '', body: '', url: '/' });
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!f.title.trim() || !f.body.trim()) { notify('ใส่หัวข้อและข้อความก่อน', 'error'); return; }
    if (!(await ask(`ส่งแจ้งเตือนถึง ${init.devices} เครื่อง?`, { text: f.title, ok: 'ส่งเลย' }))) return;
    setBusy(true);
    const r = await api<{ sent: number }>('/api/admin/settings', { action: 'push_all', ...f });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify(`ส่งแล้ว ${r.data.sent} เครื่อง ✓`); setF({ title: '', body: '', url: '/' });
  }
  return (
    <section className="card">
      <div className="card-head"><h2>แจ้งเตือนในแอปร้าน</h2><span className={`pill ${init.devices ? 'ok' : 'plain'}`}>{init.devices} เครื่องเปิดรับ</span></div>
      <div className="form">
        {!init.ready && <p style={{ color: 'var(--warn)', margin: 0 }}>⚠️ ต้องรัน SQL <code>0038_web_push.sql</code> ใน Supabase ก่อน</p>}
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>ลูกค้ากด &quot;ดาวน์โหลดแอป · เปิดแจ้งเตือน&quot; ที่หน้าประวัติการซื้อ · ระบบแจ้งเองเมื่อร้านส่งของสั่งทำ คืนเงิน หรือตอบเรื่องแจ้งปัญหา · ส่งโปรโมชันถึงทุกคนได้ที่นี่</p>
        <label className="field"><span>หัวข้อ</span><input className="input" value={f.title} maxLength={60} placeholder="เช่น 🔥 Netflix ลด 20% วันนี้วันเดียว" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="field"><span>ข้อความ</span><textarea className="input" rows={2} value={f.body} maxLength={160} placeholder="เช่น ใส่โค้ด SALE20 ตอนจ่ายเงิน" onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
        <label className="field"><span>กดแล้วไปที่</span><input className="input" value={f.url} maxLength={300} placeholder="/ หรือ /s/promotion" onChange={(e) => setF({ ...f, url: e.target.value })} /></label>
        <button type="button" className="btn primary" disabled={busy || !init.ready || !init.devices} onClick={send}>{busy ? 'กำลังส่ง…' : '🔔 ส่งแจ้งเตือนถึงลูกค้า'}</button>
      </div>
    </section>
  );
}
