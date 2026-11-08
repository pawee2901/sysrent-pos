'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';

export type MailInit = { enabled: boolean; ready: boolean; email: string };

/** Gmail ของร้าน สำหรับส่งอีเมลแจ้งลูกค้า (App Password เก็บแบบเข้ารหัส ไม่แสดงกลับมาที่หน้านี้) */
export function MailCard({ init }: { init: MailInit }) {
  const [saved, setSaved] = useState(init.email);
  const [email, setEmail] = useState(init.email);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  async function call(body: object) {
    setBusy(true);
    const r = await api('/api/admin/settings', body);
    setBusy(false);
    if (!r.ok) notify(r.error, 'error');
    return r.ok;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (await call({ action: 'mail', email, app_password: pass })) { setSaved(email.trim().toLowerCase()); setPass(''); notify('เชื่อม Gmail แล้ว'); }
  }
  async function test() { if (await call({ action: 'mail_test' })) notify(`ส่งอีเมลทดสอบไปที่ ${saved} แล้ว`); }
  async function off() {
    if (!(await ask('เลิกใช้ Gmail นี้ส่งแจ้งเตือน?', { ok: 'เลิกใช้', danger: true }))) return;
    if (await call({ action: 'mail_off' })) { setSaved(''); setEmail(''); notify('เลิกเชื่อมแล้ว'); }
  }

  return (
    <section className="card">
      <div className="card-head"><h2>แจ้งลูกค้าทางอีเมล</h2><span className={`pill ${saved ? 'ok' : 'plain'}`}>{saved ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม'}</span></div>
      <form className="form" onSubmit={save}>
        {!init.enabled && <p style={{ margin: 0, fontWeight: 600 }}>🔒 ฟังก์ชันนี้อยู่ในแพ็กเกจ Pro (฿399/เดือน) ขึ้นไป · อัปเกรดที่ sysrent.shop</p>}
        {!init.ready && <p style={{ color: 'var(--warn)', margin: 0 }}>⚠️ ต้องรัน SQL <code>0021_shop_mail.sql</code> ใน Supabase ก่อน</p>}
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>ส่งถึงลูกค้าเมื่อร้านส่งสินค้าสั่งทำ หรือคืนเงิน โดยใช้ Gmail ของร้าน ลูกค้าจะเห็นชื่อร้านเป็นผู้ส่ง</p>
        <div className="two">
          <label className="field"><span>อีเมล Gmail ของร้าน</span><input className="input" type="email" required maxLength={120} autoComplete="off" placeholder="shop@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span>App Password {saved && <small className="faint">(ใส่ใหม่เมื่อต้องการเปลี่ยน)</small>}</span><input className="input" type="password" required autoComplete="new-password" maxLength={40} placeholder="16 ตัวอักษร" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn primary" disabled={busy || !init.ready || !init.enabled}>{busy ? 'กำลังตรวจสอบ…' : saved ? 'บันทึกใหม่' : 'เชื่อม Gmail'}</button>
          {saved && <button type="button" className="btn" disabled={busy} onClick={test}>ส่งอีเมลทดสอบ</button>}
          {saved && <button type="button" className="btn ghost" disabled={busy} onClick={off}>เลิกเชื่อม</button>}
        </div>
        <details className="howto">
          <summary>วิธีเอา App Password (2 นาที)</summary>
          <ol>
            <li>เข้า <b>myaccount.google.com</b> ด้วย Gmail ของร้าน</li>
            <li>เปิด <b>การยืนยันแบบ 2 ขั้นตอน</b> (ถ้ายังไม่ได้เปิด)</li>
            <li>ค้นหาคำว่า <b>App passwords</b> ตั้งชื่ออะไรก็ได้ แล้วกดสร้าง</li>
            <li>คัดลอกรหัส 16 ตัวมาใส่ด้านบน แล้วกดเชื่อม Gmail</li>
          </ol>
          <p className="muted" style={{ fontSize: 13 }}>อย่าใช้รหัสผ่าน Gmail ปกติ · Gmail ส่งได้จำกัดต่อวันตามเงื่อนไขของ Google</p>
        </details>
      </form>
    </section>
  );
}
