'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import { PUSH_EVENTS } from '@/lib/push-events';

/** ส่งแจ้งเตือนถึงลูกค้าทุกคนที่เปิดรับในแอปร้าน (โปรโมชัน / ข่าวร้าน) */
export function PushCard({ init }: { init: { ready: boolean; devices: number; eventsReady: boolean; events: string[] } }) {
  const [f, setF] = useState({ title: '', body: '', url: '/' });
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<string[]>(init.events);
  const [evBusy, setEvBusy] = useState(false);
  async function toggle(k: string) {
    const next = events.includes(k) ? events.filter((x) => x !== k) : [...events, k];
    setEvents(next); setEvBusy(true);
    const r = await api('/api/admin/settings', { action: 'push_events', events: next });
    setEvBusy(false);
    if (!r.ok) { setEvents(events); notify(r.error, 'error'); }
  }
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
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>ลูกค้ากด &quot;ดาวน์โหลดแอป · เปิดแจ้งเตือน&quot; ที่หน้าประวัติการซื้อ · เลือกได้ว่าจะให้ระบบแจ้งอะไรบ้าง · ส่งโปรโมชันถึงทุกคนได้ด้านล่าง</p>
        <div className="field"><span>แจ้งลูกค้าอัตโนมัติเมื่อ</span>
          {!init.eventsReady && <small style={{ color: 'var(--warn)' }}>ต้องรัน SQL <code>0039_push_events.sql</code> ก่อน ถึงจะเปิด / ปิดแต่ละอย่างได้ (ตอนนี้แจ้งทุกอย่าง)</small>}
          <div className="push-evs">{PUSH_EVENTS.map(([k, label, desc]) => (
            <label key={k} className="push-ev">
              <span><b>{label}</b><small>{desc}</small></span>
              <button type="button" role="switch" aria-checked={events.includes(k)} aria-label={label} className={`toggle${events.includes(k) ? ' on' : ''}`} disabled={evBusy || !init.eventsReady} onClick={() => toggle(k)} />
            </label>))}</div></div>
        <b style={{ fontSize: 14, marginTop: 6 }}>ส่งโปรโมชัน / ข่าวร้าน ถึงทุกคน</b>
        <label className="field"><span>หัวข้อ</span><input className="input" value={f.title} maxLength={60} placeholder="เช่น 🔥 Netflix ลด 20% วันนี้วันเดียว" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="field"><span>ข้อความ</span><textarea className="input" rows={2} value={f.body} maxLength={160} placeholder="เช่น ใส่โค้ด SALE20 ตอนจ่ายเงิน" onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
        <label className="field"><span>กดแล้วไปที่</span><input className="input" value={f.url} maxLength={300} placeholder="/ หรือ /s/promotion" onChange={(e) => setF({ ...f, url: e.target.value })} /></label>
        <button type="button" className="btn primary" disabled={busy || !init.ready || !init.devices} onClick={send}>{busy ? 'กำลังส่ง…' : '🔔 ส่งแจ้งเตือนถึงลูกค้า'}</button>
      </div>
    </section>
  );
}
