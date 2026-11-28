'use client';
import { to } from '@/lib/routes';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { ask, input, notify } from '@/components/dialog';
import { GmailGuide, HotmailGuide, MsAppGuide } from '@/components/otp/MailGuides';
import { AgentTab, type AgentInit } from './AgentTab';
import { AsksTab, type AckInit, type OtpAsk } from './AsksTab';
import { PERIODS, PERIOD_LABEL, type Period } from '@/lib/otp-agent';

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
const TABS = [['mail', 'บัญชีอีเมล'], ['apps', 'แอปพลิเคชัน'], ['asks', 'คำขอ · ป๊อปอัป'], ['agent', 'ระบบตัวแทน'], ['api', 'ตั้งค่า API']] as const;
type Tab = (typeof TABS)[number][0];

export function OtpSettings({ ready, ms, boxes, apps, logs, msApp, apis, link, openPage, agent, custLimit, asks }: { ready: boolean; ms: string; boxes: Box[]; apps: App[]; logs: Log[]; msApp: MsApp; apis: Api[]; link: string; openPage: boolean; agent: AgentInit; custLimit: { limit: number; period: Period }; asks: { ready: boolean; list: OtpAsk[]; ack: AckInit } }) {
  const [lim, setLim] = useState({ n: String(custLimit.limit), period: custLimit.period });
  const [pageUrl, setPageUrl] = useState('');
  useEffect(() => setPageUrl(`${window.location.origin}${to('/otp')}`), []);
  const router = useRouter();
  const path = usePathname();
  const [tab, setTab] = useState<Tab>('mail');
  const [busy, setBusy] = useState(false);
  // ลูกค้าค้น OTP ที่ไหน: ในเว็บร้าน / ลิงก์เว็บ OTP อื่น
  const [where, setWhere] = useState<'site' | 'link'>(link ? 'link' : 'site');
  const [url, setUrl] = useState(link);
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
    <div className="otp-page">
      <div className="page-head"><div><h1>ค้นหา OTP</h1><p>ลูกค้าที่ล็อกอินค้นรหัสได้เอง เฉพาะอีเมลในสินค้าที่ยังไม่หมดอายุของตัวเอง</p></div></div>
      {!ready && <div className="card card-pad" style={{ color: 'var(--warn)' }}>⚠️ ต้องรัน SQL <code>0024</code>, <code>0025</code> และ <code>0026</code> ใน Supabase ก่อน</div>}
      {/* หน้ารับ OTP: ลิงก์เดียวให้ลูกค้าทุกคน ไม่ต้องล็อกอิน */}
      <section className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
          <span style={{ flex: 'none', width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', fontSize: 20 }}>💬</span>
          <div style={{ flex: 1, minWidth: 0, display: 'grid' }}><b>หน้ารับ OTP</b>
            <small className="muted">{link ? 'ใช้ไม่ได้ตอนตั้งให้ลิงก์ไปเว็บ OTP อื่น (ด้านล่าง)' : openPage ? 'เปิดอยู่ · ใครมีลิงก์ก็รับรหัสได้ ไม่ต้องล็อกอิน (เฉพาะอีเมลในสินค้าที่ยังไม่หมดอายุ)' : 'ปิดอยู่ · ลูกค้าต้องล็อกอินก่อนค้นหา'}</small></div>
          <button type="button" className={`toggle${openPage ? ' on' : ''}`} aria-label="เปิด / ปิดหน้ารับ OTP" disabled={busy || !!link}
            onClick={() => call({ action: 'public_page', on: !openPage }, openPage ? 'ปิดหน้ารับ OTP แล้ว' : 'เปิดหน้ารับ OTP แล้ว · ส่งลิงก์ให้ลูกค้าได้เลย')} />
        </div>
        {openPage && !link && pageUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 18px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
            <code style={{ flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere', fontSize: 13.5 }}>🌐 {pageUrl}</code>
            <button type="button" className="btn sm" onClick={() => navigator.clipboard?.writeText(pageUrl).then(() => notify('คัดลอกลิงก์แล้ว'), () => {})}>⧉ คัดลอกลิงก์</button>
            <a className="btn sm" href={pageUrl} target="_blank" rel="noopener noreferrer">↗ เปิด</a>
          </div>
        )}
      </section>
      {/* จำกัดการรับรหัสของลูกค้า (ต่ออีเมล) */}
      <section className="card card-pad" style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        <div><h2 style={{ margin: 0, fontSize: 16 }}>⏱️ จำกัดการรับรหัสของลูกค้า</h2>
          <small className="muted">ลูกค้า 1 อีเมล รับรหัสได้กี่ครั้ง · นับเฉพาะครั้งที่ได้รหัส · ใช้กับลูกค้าที่ล็อกอิน และหน้ารับ OTP แบบไม่ใช้รหัสตัวแทน (รหัสตัวแทนตั้งโควตาแยกในแท็บ ระบบตัวแทน)</small></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>รับได้</span>
          <input className="input" inputMode="numeric" style={{ width: 80, textAlign: 'center' }} value={lim.n} aria-label="จำนวนครั้ง" onChange={(e) => setLim({ ...lim, n: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          <span>ครั้ง ต่อ</span>
          <select className="input" style={{ width: 'auto' }} value={lim.period} onChange={(e) => setLim({ ...lim, period: e.target.value as Period })}>{PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}</select>
          <button type="button" className="btn primary sm" disabled={busy || (Number(lim.n || 0) === custLimit.limit && lim.period === custLimit.period)}
            onClick={() => call({ action: 'cust_limit', limit: Math.min(1000, Number(lim.n || 0)), period: lim.period }, Number(lim.n || 0) ? `จำกัด ${Number(lim.n)} ครั้งต่อ${PERIOD_LABEL[lim.period]}แล้ว` : 'ไม่จำกัดแล้ว')}>บันทึก</button>
        </div>
        <small className="faint">{Number(lim.n || 0) ? `ครบ ${Number(lim.n)} ครั้งแล้ว ลูกค้าจะเห็นข้อความให้ติดต่อแอดมินร้าน` : 'ใส่ 0 = ไม่จำกัด'}</small>
      </section>
      <section className="card card-pad" style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
        <div><h2 style={{ margin: 0, fontSize: 16 }}>ลูกค้าค้นหา OTP ที่ไหน</h2><small className="muted">ใช้กับเมนู ค้นหา OTP · แถบล่าง · ปุ่มรับ OTP ในประวัติการซื้อ · เมนู LINE</small></div>
        <div className="otp-where" role="radiogroup" aria-label="ลูกค้าค้นหา OTP ที่ไหน" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {([['site', '🔎 ค้นหาในเว็บร้าน', 'แบบปกติ · ลูกค้าล็อกอินแล้วค้นรหัสได้ในเว็บนี้'], ['link', '🔗 ลิงก์ไปเว็บ OTP อื่น', 'เช่น เว็บเช่า OTP ของร้าน · กดแล้วเปิดลิงก์นั้น']] as const).map(([k, l, dsc]) => (
            <button key={k} type="button" role="radio" aria-checked={where === k} onClick={() => setWhere(k)}
              style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${where === k ? 'var(--accent)' : 'var(--line)'}`, background: where === k ? 'var(--accent-soft)' : 'var(--surface)', font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'grid', gap: 2 }}>
              <b style={{ color: where === k ? 'var(--accent)' : undefined }}>{l}</b><small className="muted">{dsc}</small></button>
          ))}
        </div>
        {where === 'link' && <input className="input" type="url" inputMode="url" value={url} placeholder="https://otp.ร้านของคุณ.com" onChange={(e) => setUrl(e.target.value)} />}
        <div><button type="button" className="btn primary sm" disabled={busy || (where === 'link' && !/^https:\/\/\S+$/.test(url.trim())) || (where === 'site' ? !link : url.trim() === link)}
          onClick={() => call({ action: 'save_link', link: where === 'link' ? url.trim() : '' }, where === 'link' ? 'ลูกค้าจะถูกพาไปลิงก์นี้แล้ว' : 'กลับมาค้นหาในเว็บร้านแล้ว')}>บันทึก</button>
          {where === 'link' && url && !/^https:\/\//.test(url.trim()) && <small style={{ color: 'var(--bad)', marginLeft: 8 }}>ลิงก์ต้องขึ้นต้นด้วย https://</small>}</div>
      </section>
      <div className="set-tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'asks' && asks.list.some((a) => a.status === 'open') && <span className="pill warn">{asks.list.filter((a) => a.status === 'open').length}</span>}</button>)}</div>

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
            <div key={b.id} className="otp-row">
              <div className="grow"><b>{b.email}</b><small>{LABEL[b.provider] ?? b.provider}{!b.active ? ' · ปิดอยู่' : ''}</small>{b.error && <small className="otp-err">อ่านไม่ได้: {b.error}</small>}</div>
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
          {logs.map((l) => <div key={l.id} className="otp-row"><div className="grow"><b>{l.account}</b><small>@{l.user} · {l.app} · {l.when}</small></div><span className={`pill ${l.found ? 'ok' : 'plain'}`}>{l.found ? 'พบรหัส' : 'ไม่พบ'}</span></div>)}
        </section>
      </>}

      {tab === 'apps' && <>
        <section className="card">
          <div className="card-head"><h2>แอปที่ให้ค้นได้</h2><span className="pill plain">{apps.length} แอป</span></div>
          {!apps.length && <p className="muted card-pad" style={{ margin: 0 }}>ยังไม่มีแอป เพิ่มได้จากด้านล่าง</p>}
          {apps.map((a) => (
            <div key={a.id} className="otp-row">
              <div className="grow"><b>{a.name}</b><small>คำค้น: {a.keywords}</small></div>
              {a.code && <span className="pill plain">{a.code}</span>}
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => call({ action: 'delete_app', id: a.id }, 'ลบแล้ว')}>ลบ</button>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-head"><h2>เพิ่มแอป</h2></div>
          <div className="form">
            {PRESETS.some(([n]) => !used.has(n.toLowerCase())) && <>
              <span className="otp-sub">เลือกแอปยอดนิยม กดครั้งเดียวเพิ่มได้เลย</span>
              <div className="otp-chips">{PRESETS.filter(([n]) => !used.has(n.toLowerCase())).map(([name, keywords, code]) => <button key={name} type="button" className="btn sm" disabled={busy || !ready} onClick={() => call({ action: 'add_app', name, keywords, code })}>+ {name}</button>)}</div>
              <hr className="otp-line" />
            </>}
            <span className="otp-sub">หรือเพิ่มแอปอื่นเอง</span>
            <form onSubmit={addApp} className="otp-form">
              <div className="otp-app-fields">
                <label className="field"><span>ชื่อแอป</span><input className="input" required maxLength={40} placeholder="เช่น Netflix" value={app.name} onChange={(e) => setApp({ ...app, name: e.target.value })} /></label>
                <label className="field"><span>คำค้นในเมล</span><input className="input" required maxLength={200} placeholder="netflix" value={app.keywords} onChange={(e) => setApp({ ...app, keywords: e.target.value })} /></label>
                <label className="field"><span>App Code (ไม่บังคับ)</span><input className="input" maxLength={40} placeholder="NF" value={app.code} onChange={(e) => setApp({ ...app, code: e.target.value })} /></label>
              </div>
              <small className="faint">คำค้นคือคำในชื่อผู้ส่งหรือหัวข้อเมล คั่นด้วย , · ใส่ -คำ เพื่อข้ามเมลที่มีคำนั้น · App Code ใช้กับ Cloud Run เท่านั้น</small>
              <button type="submit" className="btn primary" disabled={busy || !ready}>เพิ่มแอป</button>
            </form>
          </div>
        </section>
      </>}

      {tab === 'asks' && <AsksTab asks={asks.list} ack={asks.ack} ready={asks.ready} busy={busy} call={call} />}
      {tab === 'agent' && <AgentTab agent={agent} openPage={openPage} busy={busy} call={call} />}

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
          {apis.map((a) => <div key={a.id} className="otp-row"><div className="grow"><b>{a.name}</b><small>{a.type === 'maily' ? 'Maily Space API' : 'Cloud Run API'}</small></div><button type="button" className="btn ghost sm" disabled={busy} onClick={async () => { if (await ask(`ลบ ${a.name}?`, { ok: 'ลบ', danger: true })) call({ action: 'delete_api', id: a.id }, 'ลบแล้ว'); }}>ลบ</button></div>)}
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
    </div>
  );
}
