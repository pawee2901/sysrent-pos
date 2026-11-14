'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { THEMES, canUseTheme } from '@/lib/themes';
import { ACCENTS, HEX, accentHex, accentVars } from '@/lib/colors';
import { DiscordCard } from './DiscordCard';
import { MailCard, type MailInit } from './MailCard';
import { AppearanceCard, type AppearanceInit } from './AppearanceCard';
import { PromoCards, type Promo } from './PromoCards';

/** ตัวแปร CSS ของชั้นพื้นหลัง (รูป / สี) สำหรับตัวอย่าง */
const bgVars = (k: string, l: { bg_image: string; bg_color: string }): React.CSSProperties | undefined =>
  k === 'image' && l.bg_image ? { ['--bg-image' as string]: `url("${l.bg_image}")` }
    : k === 'color' ? { ['--bg-color' as string]: l.bg_color || BG_COLORS[0] } : undefined;

type S = { name: string; tagline: string; logo_url: string; accent: string; line_url: string; announcement: string; promptpay_id: string; receiver_name: string };
type Look = { facebook_url: string; banner_url: string; banner_link: string; popup_text: string; popup_image: string; popup_link: string; bg_style: string; bg_image: string; bg_color: string; card_style: string };
type Pic = 'banner_url' | 'popup_image' | 'bg_image';
type Tab = 'shop' | 'look' | 'home' | 'pay' | 'notify' | 'admin';
const TABS: [Tab, string][] = [['shop', 'ข้อมูลร้าน'], ['look', 'หน้าตาร้าน'], ['home', 'รูปหน้าแรก · ป๊อปอัป'], ['pay', 'รับเงิน'], ['notify', 'แจ้งเตือน'], ['admin', 'บัญชีหลังบ้าน']];
export type DiscordInit = { ready: boolean; set: boolean; hint: string; events: string[] };
const BGS: [string, string][] = [['default', 'ตามธีม'], ['plain', 'เรียบ'], ['aurora', 'ออโรร่า'], ['dots', 'จุด'], ['color', 'สีที่เลือก'], ['image', 'รูปของร้าน']];
/** สีพื้นหลังแนะนำ (อ่อน ตัวหนังสือยังอ่านง่าย) */
const CARDS: [string, string][] = [['white', 'ขาว'], ['tint', 'ตามพื้นหลัง'], ['glass', 'โปร่งแสง']];
const BG_COLORS = ['#fff1f5', '#fdf2f8', '#f5f3ff', '#eef2ff', '#eff6ff', '#ecfeff', '#f0fdf4', '#f7fee7', '#fefce8', '#fff7ed', '#fdf6ec', '#f4f4f5'];

/** ตั้งค่าร้าน + ตัวอย่างหน้าร้านบนมือถือ (เปลี่ยนแล้วเห็นทันที) */
export function SettingsClient({ initial, look: lookInit, theme: themeInit, owned, slug, admin, discord, mail, appearance, promos }: { initial: S; look: Look; theme: string; owned: string[]; slug: string; admin: string; discord: DiscordInit; mail: MailInit; appearance: AppearanceInit; promos: { ready: boolean; cards: Promo[] } }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [look, setLook] = useState(lookInit);
  const [theme, setTheme] = useState(themeInit);
  const [pw, setPw] = useState({ username: admin, password: '', password2: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const lookFile = useRef<HTMLInputElement>(null);
  const [lookTarget, setLookTarget] = useState<Pic>('banner_url');
  // แท็บที่เปิดอยู่ จำไว้ใน #hash (รีเฟรชแล้วอยู่แท็บเดิม · ส่งลิงก์ตรงไปแท็บได้)
  const [tab, setTab] = useState<Tab>('shop');
  useEffect(() => { const h = window.location.hash.slice(1) as Tab; if (TABS.some(([k]) => k === h)) setTab(h); }, []);
  const pickTab = (k: Tab) => { setTab(k); history.replaceState(null, '', `#${k}`); };

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 3500); return () => clearTimeout(t); }, [msg]);
  async function save(next: S = f, done = 'บันทึกแล้ว ✓') {
    setBusy(true); setMsg('');
    const r = await api('/api/admin/settings', { action: 'shop', ...next });
    setBusy(false);
    setMsg(r.ok ? done : r.error);
    if (r.ok) { Object.entries(accentVars(next.accent)).forEach(([k, v]) => document.documentElement.style.setProperty(k, v)); router.refresh(); }
  }
  /** โลโก้: อัปโหลด / เอาออก แล้วบันทึกทันที (ไม่ต้องกดบันทึกอีก) */
  function setLogo(url: string) {
    const next = { ...f, logo_url: url };
    setF(next);
    save(next, url ? 'บันทึกโลโก้แล้ว ✓' : 'เอาโลโก้ออกแล้ว ✓');
  }
  async function saveTheme(key: string) {
    if (key === theme) return;
    setBusy(true); setMsg('');
    const r = await api('/api/admin/settings', { action: 'theme', theme: key });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    setTheme(key); setLook({ ...look, bg_style: 'default' });
    setMsg(look.bg_style !== 'default' ? 'เปลี่ยนธีมแล้ว ✓ พื้นหลังเปลี่ยนเป็นแบบของธีมด้วย' : 'เปลี่ยนธีมแล้ว ✓ เปิดหน้าร้านดูได้เลย'); router.refresh();
  }
  async function saveLook() {
    setBusy(true); setMsg('');
    const r = await api('/api/admin/settings', { action: 'look', ...look });
    setBusy(false);
    setMsg(r.ok ? 'บันทึกแบนเนอร์ / ป๊อปอัปแล้ว ✓' : r.error);
    if (r.ok) router.refresh();
  }
  async function uploadLook(fl?: File) {
    if (!fl) return;
    const fd = new FormData(); fd.append('file', fl);
    setBusy(true);
    const r = await api<{ url: string }>('/api/admin/upload', fd);
    setBusy(false);
    if (r.ok) setLook({ ...look, [lookTarget]: r.data.url, ...(lookTarget === 'bg_image' ? { bg_style: 'image' } : {}) }); else setMsg(r.error);
  }
  const pickImage = (t: Pic) => { setLookTarget(t); lookFile.current?.click(); };
  async function savePw() {
    if (pw.password !== pw.password2) { setMsg('รหัสผ่านสองช่องไม่ตรงกัน'); return; }
    setBusy(true); setMsg('');
    const r = await api('/api/admin/settings', { action: 'admin', username: pw.username, password: pw.password });
    setBusy(false);
    setMsg(r.ok ? 'เปลี่ยนรหัสผ่านหลังบ้านแล้ว ✓' : r.error);
    if (r.ok) setPw({ ...pw, password: '', password2: '' });
  }
  async function upload(fl?: File) {
    if (!fl) return;
    const fd = new FormData(); fd.append('file', fl);
    const r = await api<{ url: string }>('/api/admin/upload', fd);
    if (r.ok) setLogo(r.data.url); else setMsg(r.error);
  }
  const accent = accentHex(f.accent);
  /** บันทึกทุกอย่างในครั้งเดียว (ข้อมูลร้าน + หน้าตา/รูป) */
  async function saveAll() {
    setBusy(true); setMsg('');
    const a = await api('/api/admin/settings', { action: 'shop', ...f });
    const b = a.ok ? await api('/api/admin/settings', { action: 'look', ...look }) : a;
    setBusy(false);
    setMsg(b.ok ? 'บันทึกแล้ว ✓' : b.error);
    if (b.ok) { Object.entries(accentVars(f.accent)).forEach(([k, v]) => document.documentElement.style.setProperty(k, v)); router.refresh(); }
  }
  const payReady = !!(f.promptpay_id && f.receiver_name);
  const withPreview = tab === 'shop' || tab === 'look' || tab === 'home';

  return (
    <>
      <div className="page-head"><div><h1>ตั้งค่าร้าน</h1><p>เปลี่ยนแล้วกดบันทึก หน้าร้านอัปเดตทันที</p></div>
        {tab !== 'notify' && tab !== 'admin' && <div className="acts"><button type="button" className="btn primary" disabled={busy} onClick={saveAll}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>}</div>
      {msg && <p role="status" className={`save-toast ${msg.includes('✓') ? 'ok' : 'bad'}`} onClick={() => setMsg('')}>{msg}</p>}
      <nav className="set-tabs" role="tablist">{TABS.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => pickTab(k)}>
          {l}{k === 'pay' && !payReady && <i className="dot-warn" title="ยังตั้งไม่ครบ" />}
        </button>))}</nav>
      <input ref={lookFile} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { uploadLook(e.target.files?.[0]); e.target.value = ''; }} />
      <div className={withPreview ? 'set-grid' : ''}>
        <div className="stack">
          {tab === 'shop' && <section className="card"><div className="card-head"><h2>ข้อมูลร้าน</h2></div>
            <div className="form">
              <div className="two"><label className="field"><span>ชื่อร้าน</span><input className="input" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
                <label className="field"><span>ที่อยู่เว็บ</span><input className="input" value={`${slug}.sysrent.shop`} disabled /></label></div>
              <label className="field"><span>ข้อความหน้าแรก</span><input className="input" value={f.tagline} maxLength={60} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></label>
              <div className="field"><span>โลโก้ร้าน (มีโลโก้ = หัวเว็บแสดงโลโก้อย่างเดียว · ใช้รูปพื้นใสได้)</span><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {f.logo_url && <img src={f.logo_url} alt="" style={{ height: 40, maxWidth: 160, objectFit: 'contain' }} />}
                <button type="button" className="btn sm" disabled={busy} onClick={() => file.current?.click()}>{f.logo_url ? 'เปลี่ยนโลโก้' : 'อัปโหลดโลโก้'}</button>
                {f.logo_url && <button type="button" className="btn ghost sm" onClick={() => setLogo('')}>เอาออก</button>}
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
              </div></div>
              <div className="two"><label className="field"><span>ลิงก์ LINE ร้าน (ปุ่มลอย)</span><input className="input" value={f.line_url} maxLength={200} placeholder="https://lin.ee/xxxx" onChange={(e) => setF({ ...f, line_url: e.target.value })} /></label>
                <label className="field"><span>ประกาศแถบบน (ไม่บังคับ)</span><input className="input" value={f.announcement} maxLength={120} placeholder="เช่น 🎉 Netflix ลด 20%" onChange={(e) => setF({ ...f, announcement: e.target.value })} /></label></div>
              <label className="field"><span>เพจ Facebook ร้าน (ปุ่มลอย + ท้ายเว็บ)</span><input className="input" value={look.facebook_url} maxLength={200} placeholder="https://facebook.com/..." onChange={(e) => setLook({ ...look, facebook_url: e.target.value })} /></label>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>🔗 เวลาแชร์ลิงก์ร้านใน LINE / Facebook จะแสดงรูปหน้าแรก (ไม่มีรูป = ใช้โลโก้)</p>
            </div></section>}

          {tab === 'look' && <>
          <AppearanceCard init={appearance} logo={f.logo_url} />
          <section className="card"><div className="card-head"><h2>ธีม</h2><span className="muted" style={{ fontSize: 13 }}>กดใช้แล้วหน้าร้านเปลี่ยนทันที</span></div>
            <div className="themes">{THEMES.map((t) => {
              const ok = canUseTheme(t.key, owned);
              return (
                <div key={t.key} className={`theme-card${theme === t.key ? ' on' : ''}${ok ? '' : ' locked'}`}>
                  <div className="store theme-mini" data-style={t.key} style={accentVars(f.accent) as React.CSSProperties}>
                    <span className="shop-bg" data-bg="default" />
                    <div className="tm-hero"><b>แอปพรีเมียม{t.key === 'cute' ? ' ♡' : ''}</b><span className="btn primary sm">ซื้อเลย</span></div>
                    <div className="tm-row"><span className="card" /><span className="card" /></div>
                  </div>
                  <div className="theme-meta">
                    <b>{t.name}</b>{t.premium && <span className={`pill ${ok ? 'ok' : 'accent'} plain`}>{ok ? 'ซื้อแล้ว' : 'ธีมพิเศษ'}</span>}
                    <small className="muted">{t.desc}</small>
                  </div>
                  {theme === t.key ? <span className="btn soft sm block" aria-current="true">✓ ใช้อยู่</span>
                    : ok ? <button type="button" className="btn sm block" disabled={busy} onClick={() => saveTheme(t.key)}>ใช้ธีมนี้</button>
                    : <a className="btn primary sm block" href="https://sysrent.shop" target="_blank" rel="noopener noreferrer">🔓 ปลดล็อกที่ sysrent.shop</a>}
                </div>
              );
            })}</div>
          </section>
          <section className="card"><div className="card-head"><h2>สี · พื้นหลัง · กล่อง</h2></div>
            <div className="form">
              <div className="field"><span>สีร้าน (ปุ่ม · ราคา · ไฮไลต์)</span><div className="swatches">
                {ACCENTS.map((c) => <button key={c.key} type="button" className={`sw${f.accent === c.key ? ' on' : ''}`} style={{ background: c.main }} onClick={() => setF({ ...f, accent: c.key })} title={c.name} aria-label={`สี${c.name}`} />)}
                <label className={`sw sw-custom${HEX.test(f.accent) ? ' on' : ''}`} title="เลือกสีเอง" style={HEX.test(f.accent) ? { background: f.accent } : undefined}>
                  <input type="color" value={accentHex(f.accent)} onChange={(e) => setF({ ...f, accent: e.target.value.toLowerCase() })} aria-label="เลือกสีเอง" />
                </label>
              </div></div>
              <div className="field"><span>พื้นหลังหน้าร้าน</span>
                <div className="bg-picks">{BGS.map(([k, l]) => (
                  <button key={k} type="button" className={`bg-pick${look.bg_style === k ? ' on' : ''}`} onClick={() => (k === 'image' && !look.bg_image ? pickImage('bg_image') : setLook({ ...look, bg_style: k, ...(k === 'color' && !look.bg_color ? { bg_color: BG_COLORS[0] } : {}) }))}>
                    <span className="shop-bg" data-bg={k} style={bgVars(k, look)} />{l}
                  </button>))}</div>
                {look.bg_style === 'color' && <div className="swatches">
                  {BG_COLORS.map((c) => <button key={c} type="button" className={`sw${look.bg_color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setLook({ ...look, bg_color: c })} aria-label={`พื้นหลัง ${c}`} />)}
                  <label className={`sw sw-custom${look.bg_color && !BG_COLORS.includes(look.bg_color) ? ' on' : ''}`} title="เลือกสีเอง" style={look.bg_color && !BG_COLORS.includes(look.bg_color) ? { background: look.bg_color } : undefined}>
                    <input type="color" value={look.bg_color || '#ffffff'} onChange={(e) => setLook({ ...look, bg_color: e.target.value.toLowerCase() })} aria-label="เลือกสีพื้นหลังเอง" />
                  </label>
                </div>}
                {look.bg_style === 'image' && <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn sm" disabled={busy} onClick={() => pickImage('bg_image')}>{look.bg_image ? 'เปลี่ยนรูปพื้นหลัง' : 'อัปโหลดรูปพื้นหลัง'}</button>
                  <span className="faint" style={{ fontSize: 12, alignSelf: 'center' }}>แนะนำรูปแนวนอนกว้าง 1600px ขึ้นไป · ลายที่ขอบรูปจะเห็นชัดบนจอคอม</span></div>}</div>
              <div className="field"><span>สีกล่อง (การ์ดสินค้า / กล่องข้อมูล)</span>
                <div className="card-picks">{CARDS.map(([k, l]) => (
                  <button key={k} type="button" className={`card-pick${look.card_style === k ? ' on' : ''}`} onClick={() => setLook({ ...look, card_style: k })}>
                    <span className="store cp-demo" data-card={k} style={look.bg_style === 'color' ? { ['--tint' as string]: look.bg_color || BG_COLORS[0] } : undefined}>
                      <span className="shop-bg" data-bg={look.bg_style === 'default' ? 'aurora' : look.bg_style} style={bgVars(look.bg_style, look)} />
                      <i className="card" /><i className="card" />
                    </span>{l}
                  </button>
                ))}</div>
                <span className="faint" style={{ fontSize: 12 }}>ตามพื้นหลัง = กล่องเป็นสีอ่อนโทนเดียวกับพื้นหลัง · โปร่งแสง = กล่องใสเห็นพื้นหลังลาง ๆ (สวยกับพื้นหลังแบบรูป)</span></div>
            </div></section>
          </>}

          {tab === 'home' && <section className="card"><div className="card-head"><h2>รูปหน้าแรก · ป๊อปอัป</h2></div>
            <div className="form">
              <div className="field"><span>รูปหน้าแรก — แสดงแทนกล่องข้อความด้านบน (แนะนำกว้าง 1600 px เช่น 1600×600)</span>
                {look.banner_url && <img src={look.banner_url} alt="" style={{ width: '100%', height: 'auto', borderRadius: 14, border: '1px solid var(--line)' }} />}
                <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn sm" disabled={busy} onClick={() => pickImage('banner_url')}>{look.banner_url ? 'เปลี่ยนรูป' : 'อัปโหลดรูปหน้าแรก'}</button>
                  {look.banner_url && <button type="button" className="btn ghost sm" onClick={() => setLook({ ...look, banner_url: '' })}>เอาออก</button>}</div></div>
              <label className="field"><span>กดรูปแล้วไปที่ (ไม่บังคับ)</span><input className="input" value={look.banner_link} maxLength={300} placeholder="เช่น /p/รหัสสินค้า หรือ https://..." onChange={(e) => setLook({ ...look, banner_link: e.target.value })} /></label>
              <div className="field"><span>ป๊อปอัปตอนลูกค้าเข้าเว็บ (ใส่รูปหรือข้อความ · ว่างทั้งคู่ = ไม่แสดง)</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {look.popup_image && <img src={look.popup_image} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} />}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="btn sm" disabled={busy} onClick={() => pickImage('popup_image')}>{look.popup_image ? 'เปลี่ยนรูปป๊อปอัป' : 'อัปโหลดรูปป๊อปอัป'}</button>
                    {look.popup_image && <button type="button" className="btn ghost sm" onClick={() => setLook({ ...look, popup_image: '' })}>เอาออก</button>}</div>
                </div>
                <textarea className="input" rows={2} value={look.popup_text} maxLength={300} placeholder="เช่น 🎉 โปรเปิดร้าน ใส่โค้ด NEW10 ลด 10%" onChange={(e) => setLook({ ...look, popup_text: e.target.value })} /></div>
              <label className="field"><span>ปุ่มในป๊อปอัปไปที่ (ไม่บังคับ)</span><input className="input" value={look.popup_link} maxLength={300} placeholder="/item/... หรือ https://..." onChange={(e) => setLook({ ...look, popup_link: e.target.value })} /></label>
            </div></section>}
          {tab === 'home' && <PromoCards init={promos} />}

          {tab === 'pay' && <section className="card"><div className="card-head"><h2>รับเงิน</h2><span className={`pill ${payReady ? 'ok' : 'warn'}`}>{payReady ? 'พร้อมใช้' : 'ยังตั้งไม่ครบ'}</span><button type="button" className="btn primary sm" disabled={busy} onClick={() => save()}>บันทึก</button></div>
            <div className="form">
              <div className="two"><label className="field"><span>พร้อมเพย์ (เบอร์ / เลขบัตร)</span><input className="input" inputMode="numeric" value={f.promptpay_id} maxLength={15} onChange={(e) => setF({ ...f, promptpay_id: e.target.value.replace(/\D/g, '') })} /></label>
                <label className="field"><span>ชื่อบัญชีตามสลิป (คั่น , ได้หลายแบบ)</span><input className="input" value={f.receiver_name} maxLength={200} placeholder="นาย สมชาย ใจดี, MR. SOMCHAI J" onChange={(e) => setF({ ...f, receiver_name: e.target.value })} /></label></div>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>✓ ตรวจสลิปอัตโนมัติโดย SysRent — ระบบเช็กว่าโอนเข้าเลขพร้อมเพย์ / ชื่อบัญชีนี้จริง · เงินเข้าบัญชีร้านโดยตรง</p>
            </div></section>}

          {tab === 'notify' && <><MailCard init={mail} /><DiscordCard init={discord} /></>}

          {tab === 'admin' && <section className="card"><div className="card-head"><h2>บัญชีหลังบ้าน</h2></div>
            <div className="form">
              <label className="field"><span>ชื่อผู้ดูแล</span><input className="input" value={pw.username} maxLength={40} onChange={(e) => setPw({ ...pw, username: e.target.value })} /></label>
              <div className="two"><label className="field"><span>รหัสผ่านใหม่</span><input className="input" type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></label>
                <label className="field"><span>ยืนยันรหัสผ่าน</span><input className="input" type="password" autoComplete="new-password" value={pw.password2} onChange={(e) => setPw({ ...pw, password2: e.target.value })} /></label></div>
              <button type="button" className="btn" disabled={busy || pw.password.length < 8} onClick={savePw}>เปลี่ยนรหัสผ่านหลังบ้าน</button>
              <span className="faint" style={{ fontSize: 12 }}>อย่างน้อย 8 ตัว · เปลี่ยนแล้วเครื่องอื่นที่ล็อกอินอยู่จะหลุดออก</span>
            </div></section>}
        </div>
        {withPreview && <div className="preview-col">
        <section className="card preview"><div className="card-head"><h2>ตัวอย่างหน้าร้าน</h2><span className="pill accent plain">สด</span></div>
          <div className="phone store" data-style={theme} data-card={look.card_style} style={{ ...accentVars(f.accent), ...(look.bg_style === 'color' ? { ['--tint' as string]: look.bg_color || BG_COLORS[0] } : {}), position: 'relative', isolation: 'isolate' } as React.CSSProperties}>
            {look.bg_style !== 'default' && <span className="shop-bg" data-bg={look.bg_style} style={{ position: 'absolute', ...bgVars(look.bg_style, look) }} />}
            <div className="phone-top">{f.logo_url ? <img src={f.logo_url} alt="" style={{ height: 32, maxWidth: 140, objectFit: 'contain', borderRadius: 8 }} />
              : <><span className="m" style={{ background: accent }}>{(f.name || 'ร').slice(0, 1).toUpperCase()}</span><span>{f.name || 'ชื่อร้าน'}</span></>}</div>
            {f.announcement && <div style={{ background: accent, color: '#fff', fontSize: 10, padding: '4px 8px', textAlign: 'center' }}>{f.announcement}</div>}
            <div className="phone-body">{look.banner_url ? <img src={look.banner_url} alt="" style={{ width: '100%', height: 'auto', borderRadius: 10 }} /> : <div className="phone-hero"><b>{f.tagline || 'ข้อความหน้าแรก'}</b><span className="btnp" style={{ background: accent }}>เลือกซื้อเลย</span></div>}
              <div className="phone-grid">{['N', '▶', 'D+', 'S'].map((x, i) => <div key={x}><span className="applogo" style={{ background: ['#141414', '#ff0033', '#0b1d5c', '#1db954'][i], color: i === 0 ? '#e50914' : '#fff' }}>{x}</span><p><b style={{ color: accent }}>฿{[99, 59, 69, 49][i]}</b></p></div>)}</div></div>
          </div>
        </section>
        </div>}
      </div>
    </>
  );
}
