'use client';
import { useState } from 'react';
import { ask } from '@/components/dialog';
import { api } from '@/components/Cart';
import type { DiscordInit } from './SettingsClient';

const EVENTS: [string, string, string][] = [
  ['order', 'ออเดอร์ใหม่', 'ลูกค้าจ่ายเงินแล้ว พร้อมรายการและยอด'],
  ['manual', 'ออเดอร์สั่งทำ / สั่งจอง', 'สินค้าแบบ "สั่งทำ" ลูกค้าจ่ายแล้วรอร้านทำให้ · แท็ก @here ให้ทุกคนในห้องเห็น'],
  ['topup', 'ลูกค้าเติมเงิน', 'เติมเข้ากระเป๋าสำเร็จ'],
  ['stock', 'ของใกล้หมด', 'สต็อก / จอว่าง เหลือ 3 หรือน้อยกว่า หลังมีคนซื้อ'],
  ['signup', 'สมาชิกใหม่', 'มีคนสมัครสมาชิกร้าน พร้อมช่องทางติดต่อที่กรอกไว้'],
  ['report', 'ลูกค้าแจ้งปัญหา', 'ลูกค้ากดแจ้งปัญหาออเดอร์ · แท็ก @here (แพ็กเกจ Pro)'],
  ['daily', 'สรุปยอดทุกวัน', 'ส่งหลังเที่ยงคืน: ยอดขาย ออเดอร์ เติมเงิน สมาชิกใหม่ และสินค้าขายดีของเมื่อวาน'],
];

/** แจ้งเตือนร้านผ่าน Discord Webhook */
export function DiscordCard({ init }: { init: DiscordInit }) {
  const [set, setSet] = useState(init.set);
  const [hint, setHint] = useState(init.hint);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState(init.events);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(clear = false) {
    if (clear && !(await ask('เลิกแจ้งเตือนเข้า Discord?', { ok: 'เลิกเชื่อม', danger: true }))) return;
    setBusy(true); setMsg(null);
    const r = await api('/api/admin/settings', { action: 'discord', url: clear ? '' : url.trim(), clear, events });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    if (clear) { setSet(false); setHint(''); } else if (url.trim()) { setSet(true); setHint(url.trim().slice(-6)); setUrl(''); }
    setMsg({ ok: true, text: clear ? 'ปิดแจ้งเตือนแล้ว' : 'บันทึกแล้ว ✓' });
  }
  async function test() {
    setBusy(true); setMsg(null);
    const r = await api('/api/admin/settings', { action: 'discord_test' });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: 'ส่งข้อความทดสอบแล้ว ✓ ไปดูในห้อง Discord ได้เลย' } : { ok: false, text: r.error });
  }

  return (
    <section className="card">
      <div className="card-head"><h2>แจ้งเตือนผ่าน Discord</h2><span className={`pill ${set ? 'ok' : 'plain'}`}>{set ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม'}</span></div>
      <div className="form">
        {!init.ready && <p style={{ color: 'var(--warn)', margin: 0 }}>⚠️ ต้องรัน SQL <code>0009_discord_notify.sql</code> ใน Supabase ก่อน</p>}
        <label className="field"><span>{set ? `ลิงก์ Webhook (ใช้อยู่ …${hint}) — วางลิงก์ใหม่ถ้าต้องการเปลี่ยน` : 'ลิงก์ Webhook ของห้อง Discord'}</span>
          <input className="input" value={url} maxLength={300} placeholder="https://discord.com/api/webhooks/..." onChange={(e) => setUrl(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 13 }} /></label>

        <div className="field"><span>แจ้งเรื่องอะไรบ้าง</span>
          <div className="notify-events">{EVENTS.map(([k, l, d]) => (
            <label key={k} className="notify-ev">
              <input type="checkbox" checked={events.includes(k)} onChange={(e) => setEvents(e.target.checked ? [...events, k] : events.filter((x) => x !== k))} />
              <span><b>{l}</b><small className="muted">{d}</small></span>
            </label>
          ))}</div></div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn primary" disabled={busy || !init.ready || (!set && !url.trim())} onClick={() => save()}>บันทึก</button>
          {set && <button type="button" className="btn" disabled={busy} onClick={test}>ส่งข้อความทดสอบ</button>}
          {set && <button type="button" className="btn ghost" disabled={busy} onClick={() => save(true)}>เลิกเชื่อม</button>}
        </div>
        {msg && <p style={{ margin: 0, color: msg.ok ? 'var(--ok)' : 'var(--bad)' }} role="status">{msg.text}</p>}

        <details className="howto">
          <summary>วิธีเอาลิงก์ Webhook (1 นาที)</summary>
          <ol>
            <li>เปิด Discord → เข้าเซิร์ฟเวอร์ของร้าน → เลือกห้องที่อยากให้แจ้ง (เช่น #ออเดอร์)</li>
            <li>กดรูปฟันเฟือง <b>แก้ไขช่อง</b> → <b>การเชื่อมต่อ (Integrations)</b> → <b>Webhooks</b> → <b>Webhook ใหม่</b></li>
            <li>ตั้งชื่อ / รูปได้ตามใจ → กด <b>คัดลอก URL ของ Webhook</b></li>
            <li>วางในช่องด้านบน → บันทึก → กด &quot;ส่งข้อความทดสอบ&quot;</li>
          </ol>
          <p className="muted" style={{ fontSize: 13 }}>ห้ามแชร์ลิงก์นี้ให้คนอื่น — ใครได้ลิงก์ไปจะส่งข้อความเข้าห้องได้ (ถ้าหลุด ลบ Webhook ใน Discord แล้วสร้างใหม่)</p>
        </details>
      </div>
    </section>
  );
}
