'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { ask, input, notify } from '@/components/dialog';
import { GmailGuide, HotmailGuide, MsAppGuide } from '@/components/otp/MailGuides';

type Box = { id: string; email: string; provider: string; active: boolean; error: string };
type App = { id: string; name: string; keywords: string; code: string };
type Log = { id: string; user: string; account: string; app: string; found: boolean; when: string };
type MsApp = { clientId: string; hasSecret: boolean; redirect: string };
type Api = { id: string; name: string; type: string };

const PRESETS: [string, string, string][] = [['Netflix', 'netflix', 'NF'], ['Disney+', 'disney', 'DN'], ['ChatGPT', 'openai, chatgpt', 'GPT'], ['Prime Video', 'amazon, primevideo', 'PR'], ['YouTube', 'youtube, google', ''], ['Viu', 'viu', ''], ['WeTV', 'wetv, tencent', ''], ['iQIYI', 'iqiyi', '']];
const MAX_BOXES = 10;
const MS_RESULT: Record<string, string> = {
  denied: 'ยังไม่ได้กดยอมรับสิทธิ์อ่านอีเมล กรุณาเชื่อมใหม่', bad_state: 'ลิงก์หมดอายุ กรุณากดเชื่อมต่ออีกครั้ง', missing: 'ตั้ง Microsoft App ในแท็บตั้งค่า API ก่อน', plan: 'ค้นหา OTP อยู่ในแพ็กเกจ Max',
  token: 'เชื่อมไม่สำเร็จ ตรวจ Client Secret และ Redirect URI', exists: 'อีเมลนี้เชื่อมแบบอื่นไว้แล้ว ลบกล่องเดิมก่อน', limit: `เพิ่มกล่องได้สูงสุด ${MAX_BOXES} กล่อง`,
  sql: 'ต้องรัน SQL 0024, 0025 และ 0026 ใน Supabase ก่อน', save: 'บันทึกไม่สำเร็จ กรุณาลองใหม่',
};
const LABEL: Record<string, string> = { gmail: 'Gmail', maily: 'Maily', graph: 'Hotmail / Outlook' };
const TABS = [['mail', 'บัญชีอีเมล'], ['apps', 'แอปพลิเคชัน'], ['api', 'ตั้งค่า API']] as const;
type Tab = (typeof TABS)[number][0];

export function OtpSettings({ ready, ms, boxes, apps, logs, msApp, apis }: { ready: boolean; ms: string; boxes: Box[]; apps: App[]; logs: Log[]; msApp: MsApp; apis: Api[] }) {
  const router = useRouter();
  const path = usePathname();
  const [tab, setTab] = useState<Tab>('mail');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<'gmail' | 'maily' | null>(null);
  const [guide, setGuide] = useState<'gmail' | 'hotmail' | 'msapp' | null>(null);
  const [form, setForm] = useState({ email: '', password: '', pin: '' });
  const [app, setApp] = useState({ name: '', keywords: '', code: '' });
  const [ms1, setMs1] = useState({ client_id: msApp.clientId, client_secret: '' });
  const [key, setKey] = useState({ name: '', type: 'maily', token: '' });
  const msReady = !!msApp.clientId && msApp.hasSecret;
  const hasMaily = apis.some((a) => a.type === 'maily');

  useEffect(() => {
    if (!ms) return;
    if (ms === 'ok') notify('เชื่อมต่อ Hotmail เรียบร้อย'); else notify(MS_RESULT[ms] ?? 'เชื่อมต่อไม่สำเร็จ', 'error');
    router.replace(path);
  }, [ms, path, router]);

  async function call(payload: object, ok?: string) {
    setBusy(true);
    const r = await api('/api/admin/otp', payload);
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return false; }
    if (ok) notify(ok);
    router.refresh();
    return true;
  }
  async function connectMs(hint = '') {
    if (!msReady) { setTab('api'); notify('ตั้ง Microsoft App ของร้านก่อน แล้วค่อยกดเชื่อมต่อ', 'error'); return; }
    setBusy(true);
    const r = await api<{ url: string }>('/api/admin/otp/microsoft', { hint });
    if (r.ok) { window.location.href = r.data.url; return; }
    setBusy(false);
    notify(r.error, 'error');
  }
  async function addBox(e: React.FormEvent) {
    e.preventDefault();
    const payload = adding === 'gmail' ? { action: 'add_gmail', email: form.email, password: form.password } : { action: 'add_maily', email: form.email, pin: form.pin };
    if (await call(payload, 'เพิ่มอีเมลแล้ว')) { setForm({ email: '', password: '', pin: '' }); setAdding(null); }
  }
  async function setPin(b: Box) {
    const v = await input(`PIN 6 หลักของกล่อง ${b.email}`, { text: 'ปล่อยว่างเพื่อลบ PIN' });
    if (v === null || v === undefined) return;
    call({ action: 'maily_pin', id: b.id, pin: v.trim() }, v.trim() ? 'บันทึก PIN แล้ว' : 'ลบ PIN แล้ว');
  }
  async function addApp(e: React.FormEvent) {
    e.preventDefault();
    if (await call({ action: 'add_app', ...app }, 'เพิ่มแอปแล้ว')) setApp({ name: '', keywords: '', code: '' });
  }
  async function saveMs(e: React.FormEvent) {
    e.preventDefault();
    if (await call({ action: 'save_ms', ...ms1 }, 'บันทึก Microsoft App แล้ว ไปกดเชื่อมต่อที่แท็บบัญชีอีเมลได้เลย')) setMs1({ ...ms1, client_secret: '' });
  }
  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    if (await call({ action: 'add_api', ...key }, 'เพิ่มแล้ว')) setKey({ name: '', type: 'maily', token: '' });
  }
  function copyRedirect() {
    navigator.clipboard?.writeText(msApp.redirect).then(() => notify('คัดลอก Redirect URI แล้ว'), () => {});
  }
  const used = new Set(apps.map((a) => a.name.toLowerCase()));
  const full = boxes.length >= MAX_BOXES;
  const toggleGuide = (g: 'gmail' | 'hotmail' | 'msapp') => setGuide(guide === g ? null : g);

  return (
    <>
      <div className="page-head"><div><h1>ค้นหา OTP</h1><p>ลูกค้าที่ล็อกอินค้นรหัสได้เอง เฉพาะอีเมลในสินค้าที่ยังไม่หมดอายุของตัวเอง</p></div></div>
      {!ready && <div className="card card-pad" style={{ color: 'var(--warn)' }}>⚠️ ต้องรัน SQL <code>0024</code>, <code>0025</code> และ <code>0026</code> ใน Supabase ก่อน</div>}
      <div className="seg" role="tablist" style={{ marginBottom: 14 }}>{TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'mail' && <>
        <section className="card">
          <div className="card-head"><h2>เพิ่มอีเมล</h2><span className="pill plain">{boxes.length} / {MAX_BOXES}</span></div>
          <div className="otp-kinds">
            <div className="otp-kind"><b>Gmail</b><small>ใช้ App Password</small><button type="button" className="btn primary sm" disabled={busy || !ready || full} onClick={() => setAdding(adding === 'gmail' ? null : 'gmail')}>เพิ่ม</button><button type="button" className="btn ghost sm" onClick={() => toggleGuide('gmail')}>วิธีเชื่อม</button></div>
            <div className="otp-kind"><b>Hotmail</b><small>{msReady ? 'ล็อกอินหน้า Microsoft' : 'ตั้ง Microsoft App ก่อน'}</small><button type="button" className="btn primary sm" disabled={busy || !ready || full} onClick={() => connectMs()}>เชื่อมต่อ</button><button type="button" className="btn ghost sm" onClick={() => toggleGuide('hotmail')}>วิธีเชื่อม</button></div>
            <div className="otp-kind"><b>Maily</b><small>{hasMaily ? 'ใช้ Token ในหน้า API' : 'ใส่ Token ในหน้า API ก่อน'}</small><button type="button" className="btn primary sm" disabled={busy || !ready || full} onClick={() => setAdding(adding === 'maily' ? null : 'maily')}>เพิ่ม</button></div>
          </div>
          {guide === 'gmail' && <div className="card-pad"><GmailGuide /></div>}
          {guide === 'hotmail' && <div className="card-pad"><HotmailGuide /></div>}
          {adding && (
            <form className="form" onSubmit={addBox}>
              <div className="two">
                <label className="field"><span>อีเมล {adding === 'gmail' ? 'Gmail' : 'Maily'}</span><input className="input" type="email" required maxLength={120} autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                {adding === 'gmail'
                  ? <label className="field"><span>App Password 16 ตัว</span><input className="input" type="password" required maxLength={40} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
                  : <label className="field"><span>PIN กล่อง 6 หลัก (ถ้าตั้งไว้ใน maily.space)</span><input className="input" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} /></label>}
              </div>
              {adding === 'maily' && <small className="faint">ใช้ได้กับ @lico.moe, @rdcw.plus, @gooddaymail.com · กล่องที่ตั้ง PIN ไว้ต้องกรอก ไม่งั้น Maily จะไม่ให้อ่านเมล</small>}
              <button type="submit" className="btn primary" disabled={busy}>{busy ? 'กำลังตรวจสอบ…' : 'บันทึกอีเมล'}</button>
            </form>
          )}
        </section>
        <section className="card">
          <div className="card-head"><h2>อีเมลของร้าน</h2></div>
          {!boxes.length && <p className="muted card-pad" style={{ margin: 0 }}>ยังไม่มีอีเมลของร้าน กดปุ่มด้านบนเพื่อเพิ่ม</p>}
          {boxes.map((b) => (
            <div key={b.id} className="line-item">
              <div className="grow"><b>{b.email}</b><small>{LABEL[b.provider] ?? b.provider}{!b.active ? ' · ปิดอยู่' : ''}{b.error ? ` · อ่านไม่ได้: ${b.error}` : ''}</small></div>
              {b.provider === 'graph' && <button type="button" className={`btn sm${b.error ? ' primary' : ''}`} disabled={busy} onClick={() => connectMs(b.email)}>เชื่อมใหม่</button>}
              {b.provider === 'maily' && <button type="button" className="btn sm" disabled={busy} onClick={() => setPin(b)}>PIN</button>}
              <button type="button" className="btn sm" disabled={busy} onClick={() => call({ action: 'toggle_box', id: b.id, active: !b.active })}>{b.active ? 'ปิด' : 'เปิด'}</button>
              <button type="button" className="btn ghost sm" disabled={busy} onClick={async () => { if (await ask(`ลบกล่อง ${b.email}?`, { ok: 'ลบ', danger: true })) call({ action: 'delete_box', id: b.id }, 'ลบแล้ว'); }}>ลบ</button>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-head"><h2>การค้นหาล่าสุด</h2></div>
          {!logs.length && <p className="muted card-pad" style={{ margin: 0 }}>ยังไม่มีการค้นหา</p>}
          {logs.map((l) => <div key={l.id} className="line-item"><div className="grow"><b>{l.account}</b><small>@{l.user} · {l.app} · {l.when}</small></div><span className={`pill ${l.found ? 'ok' : 'plain'}`}>{l.found ? 'พบรหัส' : 'ไม่พบ'}</span></div>)}
        </section>
      </>}

      {tab === 'apps' && (
        <section className="card">
          <div className="card-head"><h2>แอปที่ให้ค้นได้</h2></div>
          {apps.map((a) => (
            <div key={a.id} className="line-item">
              <div className="grow"><b>{a.name}</b><small>คำค้น: {a.keywords}{a.code ? ` · App Code: ${a.code}` : ''}</small></div>
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => call({ action: 'delete_app', id: a.id }, 'ลบแล้ว')}>ลบ</button>
            </div>
          ))}
          <div className="form">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESETS.filter(([n]) => !used.has(n.toLowerCase())).map(([name, keywords, code]) => <button key={name} type="button" className="btn sm" disabled={busy || !ready} onClick={() => call({ action: 'add_app', name, keywords, code })}>+ {name}</button>)}
            </div>
            <form onSubmit={addApp} style={{ display: 'grid', gap: 12 }}>
              <div className="two">
                <label className="field"><span>ชื่อแอป</span><input className="input" required maxLength={40} value={app.name} onChange={(e) => setApp({ ...app, name: e.target.value })} /></label>
                <label className="field"><span>คำค้นในผู้ส่งหรือหัวข้อเมล (คั่นด้วย ,)</span><input className="input" required maxLength={200} placeholder="netflix" value={app.keywords} onChange={(e) => setApp({ ...app, keywords: e.target.value })} /></label>
              </div>
              <label className="field"><span>App Code (เฉพาะ Cloud Run เช่น NF, DN)</span><input className="input" maxLength={40} value={app.code} onChange={(e) => setApp({ ...app, code: e.target.value })} /></label>
              <small className="faint">ใส่ -คำ เพื่อข้ามเมลที่มีคำนั้น เช่น netflix, -password</small>
              <button type="submit" className="btn" disabled={busy || !ready}>เพิ่มแอป</button>
            </form>
          </div>
        </section>
      )}

      {tab === 'api' && <>
        <section className="card">
          <div className="card-head"><h2>เชื่อมต่อ Hotmail / Outlook (Microsoft App)</h2><span className={`pill ${msReady ? 'ok' : 'plain'}`}>{msReady ? 'ตั้งค่าแล้ว' : 'ยังไม่ตั้งค่า'}</span></div>
          <form className="form" onSubmit={saveMs}>
            <div className="two">
              <label className="field"><span>Application (client) ID</span><input className="input" required maxLength={36} autoComplete="off" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={ms1.client_id} onChange={(e) => setMs1({ ...ms1, client_id: e.target.value })} /></label>
              <label className="field"><span>Client Secret (Value)</span><input className="input" type="password" maxLength={200} autoComplete="new-password" required={!msApp.hasSecret} placeholder={msApp.hasSecret ? 'บันทึกไว้แล้ว (เว้นว่างถ้าไม่เปลี่ยน)' : ''} value={ms1.client_secret} onChange={(e) => setMs1({ ...ms1, client_secret: e.target.value })} /></label>
            </div>
            <div className="otp-redirect"><span>Redirect URI ที่ต้องใส่ใน Azure (Authentication → Web) ให้ตรงทุกตัวอักษร</span><code>{msApp.redirect}</code><button type="button" className="btn sm" onClick={copyRedirect}>คัดลอก</button></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="btn primary" disabled={busy || !ready}>บันทึก Microsoft App</button>
              <button type="button" className="btn" onClick={() => toggleGuide('msapp')}>{guide === 'msapp' ? 'ซ่อนวิธีสร้าง' : 'วิธีสร้าง Microsoft App'}</button>
              {msReady && <button type="button" className="btn ghost" disabled={busy} onClick={async () => { if (await ask('ลบ Microsoft App ของร้าน? Hotmail ที่เชื่อมไว้จะอ่านเมลไม่ได้จนกว่าจะตั้งใหม่', { ok: 'ลบ', danger: true })) { if (await call({ action: 'delete_ms' }, 'ลบแล้ว')) setMs1({ client_id: '', client_secret: '' }); } }}>ลบการตั้งค่า</button>}
            </div>
            {guide === 'msapp' && <MsAppGuide />}
            <small className="faint">Client Secret เข้ารหัสก่อนเก็บ และไม่แสดงกลับบนหน้านี้ · Secret มีวันหมดอายุ ก่อนหมดให้สร้างใหม่แล้วบันทึกทับ</small>
          </form>
        </section>
        <section className="card">
          <div className="card-head"><h2>API ภายนอก (Maily · Cloud Run)</h2></div>
          {apis.map((a) => <div key={a.id} className="line-item"><div className="grow"><b>{a.name}</b><small>{a.type === 'maily' ? 'Maily Space API' : 'Cloud Run API'}</small></div><button type="button" className="btn ghost sm" disabled={busy} onClick={async () => { if (await ask(`ลบ ${a.name}?`, { ok: 'ลบ', danger: true })) call({ action: 'delete_api', id: a.id }, 'ลบแล้ว'); }}>ลบ</button></div>)}
          <form className="form" onSubmit={addKey}>
            <div className="two">
              <label className="field"><span>ชื่ออ้างอิง</span><input className="input" required maxLength={40} placeholder="เช่น Maily หลัก" value={key.name} onChange={(e) => setKey({ ...key, name: e.target.value })} /></label>
              <label className="field"><span>ประเภท</span><select className="input" value={key.type} onChange={(e) => setKey({ ...key, type: e.target.value })}><option value="maily">Maily Space API (Token)</option><option value="cloud_run">Cloud Run API (URL)</option></select></label>
            </div>
            <label className="field"><span>{key.type === 'maily' ? 'API Key / Token' : 'URL ของ Cloud Run (https://....run.app)'}</span><input className="input" type={key.type === 'maily' ? 'password' : 'url'} required maxLength={500} autoComplete="new-password" value={key.token} onChange={(e) => setKey({ ...key, token: e.target.value })} /></label>
            <small className="faint">{key.type === 'maily' ? 'คัดลอกจาก maily.space/dashboard/api' : 'ระบบถามด้วยอีเมลลูกค้า + App Code ของแอป ใช้กับอีเมลที่ไม่ใช่ Gmail หรือ Maily'}</small>
            <button type="submit" className="btn primary" disabled={busy || !ready}>เพิ่ม API</button>
          </form>
        </section>
      </>}
    </>
  );
}
