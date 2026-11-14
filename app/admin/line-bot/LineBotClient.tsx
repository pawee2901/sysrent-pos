'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import { DEFAULT_MSG, MENU_ITEMS, MESSAGES, PUSHES, TONES, VAR_LABEL, botText, type BotConfig, type MenuKey } from '@/lib/line-bot-config';

type Props = {
  config: BotConfig; sell: boolean; line: { botName: string; basicId: string } | null; webhook: string;
  shop: { name: string; logo: string; accent: string; otp: boolean; renew: boolean };
  sample: { name: string; price: number; sold: number; left: number | null; image: string } | null;
};
const copy = (t: string) => { navigator.clipboard?.writeText(t).then(() => notify('คัดลอกแล้ว', 'success')).catch(() => {}); };
const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } as const;

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className={`toggle${on ? ' on' : ''}`} aria-label={label} aria-pressed={on} onClick={() => onChange(!on)} style={{ flex: 'none' }} />;
}

export function LineBotClient({ config, sell: sellInit, line, webhook, shop, sample }: Props) {
  const router = useRouter();
  const [cfg, setCfg] = useState<BotConfig>(config);
  const [saved, setSaved] = useState(JSON.stringify(config));
  const [busy, setBusy] = useState(false);
  const [sell, setSell] = useState(sellInit);
  const dirty = JSON.stringify(cfg) !== saved;
  const set = (patch: Partial<BotConfig>) => setCfg({ ...cfg, ...patch });

  async function call(b: object, confirmText?: string) {
    if (confirmText && !(await ask(confirmText, { ok: 'ยืนยัน' }))) return false;
    setBusy(true);
    const r = await api<{ notice?: string }>('/api/admin/line-bot', b);
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return false; }
    if (r.data.notice) notify(r.data.notice, 'success');
    router.refresh();
    return true;
  }
  const save = async () => { if (await call({ action: 'config', config: cfg })) setSaved(JSON.stringify(cfg)); };

  const moveMenu = (i: number, d: -1 | 1) => {
    const m = [...cfg.menu]; const j = i + d;
    if (j < 0 || j >= m.length) return;
    [m[i], m[j]] = [m[j], m[i]];
    set({ menu: m });
  };
  const menuShown = (k: MenuKey) => (k !== 'otp' || shop.otp) && (k !== 'renew' || shop.renew);

  return (
    <>
      <div className="page-head"><div><h1>บอท LINE</h1><p>ให้บอทขายของแทนในแชท LINE OA ของร้าน</p></div>
        <div className="acts"><button type="button" className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? 'กำลังบันทึก…' : dirty ? 'บันทึกการตั้งค่า' : 'บันทึกแล้ว'}</button></div></div>

      <div className="rn-grid">
        <div className="rn-col">
          <Connect line={line} webhook={webhook} cfg={cfg} set={set} sell={sell} setSell={async (v) => { if (await call({ action: 'sell', on: v })) setSell(v); }} call={call} />

          {/* ---------- น้ำเสียง + ข้อความ ---------- */}
          <section className="card">
            <div className="card-head"><div><h2>หน้าตาและข้อความของบอท</h2><small className="muted">ปรับน้ำเสียง ข้อความ ปุ่มเมนู การ์ดสินค้า และเลือกว่าจะให้บอทส่งข้อความที่เสียโควตา LINE ตอนไหนบ้าง</small></div></div>
            <div className="rn-body">
              <div><b>น้ำเสียง</b><br /><small className="muted">คำลงท้ายที่บอทใช้ทุกข้อความ</small></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {TONES.map((t) => (
                  <button key={t.key} type="button" onClick={() => set({ tone: t.key })} className="card" style={{ textAlign: 'left', padding: '12px 14px', cursor: 'pointer', borderColor: cfg.tone === t.key ? 'var(--text)' : undefined, borderWidth: cfg.tone === t.key ? 2 : undefined }}>
                    <b>{t.label}{cfg.tone === t.key ? ' ✓' : ''}</b><br /><small className="muted">{t.sample}</small>
                  </button>
                ))}
              </div>

              <div><b>ข้อความของร้าน</b><br /><small className="muted">เว้นว่างไว้ บอทใช้ข้อความของระบบตามน้ำเสียงที่เลือก</small></div>
              {MESSAGES.map((m) => {
                const v = cfg.messages[m.key] ?? '';
                const put = (s: string) => set({ messages: { ...cfg.messages, [m.key]: s.slice(0, 500) } });
                return (
                  <label key={m.key} className="field" style={{ margin: 0 }}>
                    <span style={row}><span>{m.label}</span><small className="muted">{v.length}/500</small></span>
                    <textarea className="input" rows={3} value={v} maxLength={500} placeholder={DEFAULT_MSG[cfg.tone][m.key]} onChange={(e) => put(e.target.value)} />
                    <span style={{ ...row, flexWrap: 'wrap' }}>
                      <small className="muted">{m.hint}</small>
                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{m.vars.map((x) => (
                        <button key={x} type="button" className="pill plain" style={{ cursor: 'pointer', border: 0 }} onClick={(e) => { e.preventDefault(); put(`${v}{${x}}`); }}><code>{`{${x}}`}</code> {VAR_LABEL[x]}</button>
                      ))}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* ---------- ปุ่มเมนู + การ์ดสินค้า ---------- */}
          <section className="card">
            <div className="card-head"><div><h2>ปุ่มเมนูหลัก</h2><small className="muted">ปุ่มบนการ์ดต้อนรับ เรียงตามลำดับนี้ ปุ่มแรกเป็นสีหลักของร้าน</small></div></div>
            <div className="rn-body" style={{ gap: 6 }}>
              {cfg.menu.map((m, i) => menuShown(m.key) && (
                <div key={m.key} style={{ ...row, border: '1px solid var(--line)', borderRadius: 12, padding: '6px 10px', opacity: m.on ? 1 : .55 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                    <button type="button" className="icon-btn" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => moveMenu(i, -1)} style={{ height: 18 }}>↑</button>
                    <button type="button" className="icon-btn" aria-label="เลื่อนลง" disabled={i === cfg.menu.length - 1} onClick={() => moveMenu(i, 1)} style={{ height: 18 }}>↓</button>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{MENU_ITEMS[m.key].icon} {MENU_ITEMS[m.key].label}{MENU_ITEMS[m.key].hint && <small className="muted"> · {MENU_ITEMS[m.key].hint}</small>}</span>
                  <Toggle on={m.on} label={`เปิด/ปิดปุ่ม ${MENU_ITEMS[m.key].label}`} onChange={(on) => set({ menu: cfg.menu.map((x, j) => (j === i ? { ...x, on } : x)) })} />
                </div>
              ))}
            </div>
            <div className="card-head" style={{ borderTop: '1px solid var(--line)' }}><div><h2>การ์ดสินค้า</h2><small className="muted">ตอนลูกค้ากดดูสินค้าในแชท</small></div></div>
            <div className="rn-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([['large', '▦ รูปใหญ่', 'เห็นรูปสินค้าชัด'], ['compact', '☰ กะทัดรัด', 'รูปเล็กข้างชื่อ เลื่อนดูได้ไว']] as const).map(([k, l, h]) => (
                  <button key={k} type="button" className="card" onClick={() => set({ card: { ...cfg.card, style: k } })} style={{ textAlign: 'left', padding: '12px 14px', cursor: 'pointer', borderColor: cfg.card.style === k ? 'var(--text)' : undefined, borderWidth: cfg.card.style === k ? 2 : undefined }}>
                    <b>{l}</b><br /><small className="muted">{h}</small>
                  </button>
                ))}
              </div>
              {([['sold', 'แสดงยอดขาย', '"ขายแล้ว 128 ชิ้น" ใต้ราคา'], ['stock', 'แสดงจำนวนคงเหลือ', '"เหลือ 5 ชิ้น" สำหรับของพร้อมส่ง'], ['logo', 'โลโก้ร้านบนการ์ดต้อนรับ', 'ใช้โลโก้จาก ตั้งค่าร้าน']] as const).map(([k, l, h]) => (
                <div key={k} style={row}><div><b>{l}</b><br /><small className="muted">{h}</small></div><Toggle on={cfg.card[k]} label={l} onChange={(on) => set({ card: { ...cfg.card, [k]: on } })} /></div>
              ))}
            </div>
          </section>

          {/* ---------- ข้อความที่เสียโควตา ---------- */}
          <section className="card">
            <div className="card-head"><div><h2>ข้อความที่เสียโควตา LINE</h2><small className="muted">บอทตอบตอนลูกค้าทักมาฟรีเสมอ แต่ข้อความที่บอททักไปหาลูกค้าเองทีหลัง (push) นับโควตารายเดือนของ LINE OA ร้าน — ปิดได้ทั้งหมด เปิดเฉพาะที่อยากจ่าย</small></div></div>
            <div className="rn-body">
              {PUSHES.map((p) => (
                <div key={p.key} style={row}><div><b>{p.label}</b><br /><small className="muted">{p.hint}</small></div><Toggle on={cfg.push[p.key]} label={p.label} onChange={(on) => set({ push: { ...cfg.push, [p.key]: on } })} /></div>
              ))}
              <p style={{ margin: 0, padding: '10px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--ok, #16a34a) 10%, var(--surface))', fontSize: 13 }}>
                ฟรีเสมอ: ผลตรวจสลิปที่ส่งในแชท (ระบบตรวจให้ทันที), รหัส / โค้ด / ใบเสร็จและของที่ลูกค้ากดซื้อ และทุกอย่างที่ลูกค้ากดเอง · เตือนต่อเมลตั้งได้ที่เมนู &quot;ต่อเมล&quot;
              </p>
            </div>
          </section>
        </div>

        <Preview cfg={cfg} shop={shop} sample={sample} />
      </div>
      {dirty && (
        <div style={{ position: 'sticky', bottom: 12, display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn primary lg" disabled={busy} onClick={save} style={{ boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>{busy ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</button>
        </div>
      )}
    </>
  );
}

/** เชื่อม LINE OA + เปิด/ปิดบอท + เปิด/ปิดขายของ */
function Connect({ line, webhook, cfg, set, sell, setSell, call }: {
  line: Props['line']; webhook: string; cfg: BotConfig; set: (p: Partial<BotConfig>) => void; sell: boolean; setSell: (v: boolean) => void; call: (b: object, c?: string) => Promise<boolean>;
}) {
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [open, setOpen] = useState(!line);
  return (
    <section className="card">
      <div className="card-head"><div><h2>บอทขายของใน LINE</h2><small className="muted">ลูกค้าทัก LINE OA ของร้าน บอทจะตอบแทนแม่ค้า ให้เลือกสั่งของ รับชำระ และส่งสินค้าดิจิทัลให้ในแชท</small></div>
        {line ? <span className="pill ok">เชื่อมแล้ว · {line.botName}</span> : <span className="pill warn">ยังไม่เชื่อม</span>}</div>
      <div className="rn-body">
        <div style={row}><div><b>เปิดบอท</b><br /><small className="muted">ปิดไว้ก่อนได้ ข้อมูลที่เชื่อมยังอยู่ ระหว่างปิดบอทจะไม่ตอบแชท (กดบันทึกด้านบน)</small></div><Toggle on={cfg.enabled} label="เปิดบอท" onChange={(enabled) => set({ enabled })} /></div>
        <div style={row}><div><b>ขายสินค้าในแชท</b><br /><small className="muted">ปิด = บอททำแค่เรื่องต่อเมล (บันทึกทันที)</small></div><Toggle on={sell} label="ขายสินค้าในแชท" onChange={setSell} /></div>
        {line && !open && (
          <div className="rn-acts">
            <button type="button" className="btn sm primary" onClick={() => call({ action: 'line_test' })}>ทดสอบการเชื่อมต่อ</button>
            <button type="button" className="btn sm ghost" onClick={() => setOpen(true)}>เปลี่ยนรหัส / วิธีตั้งค่า</button>
            <button type="button" className="btn sm ghost" onClick={() => call({ action: 'line_delete' }, 'ยกเลิกการเชื่อม LINE? บอทจะหยุดตอบแชท ส่งเตือน และรับเงินในแชท')}>ยกเลิกการเชื่อม</button>
          </div>
        )}
        {open && <>
          <ol className="rn-steps">
            <li>เปิด <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer"><b>LINE Developers</b></a> แล้วเลือก Messaging API channel ของ LINE OA ร้าน (ยังไม่มี: LINE OA Manager → ตั้งค่า → Messaging API → ใช้ Messaging API)</li>
            <li>แท็บ <b>Basic settings</b> คัดลอก <b>Channel secret</b></li>
            <li>แท็บ <b>Messaging API</b> กด <b>Issue</b> ที่ Channel access token (long-lived) แล้วคัดลอก</li>
            <li>วางทั้งสองช่องด้านล่างแล้วบันทึก <b>ระบบจะตั้ง Webhook ให้เอง</b></li>
            <li>ในแท็บเดียวกัน เปิด <b>Use webhook</b> และปิด <b>Auto-reply messages</b> กับ <b>Greeting messages</b></li>
          </ol>
          <label className="field" style={{ margin: 0 }}><span>Channel secret</span><input className="input" value={secret} maxLength={64} autoComplete="off" placeholder="ตัวอักษร 32 ตัว" onChange={(e) => setSecret(e.target.value.trim())} /></label>
          <label className="field" style={{ margin: 0 }}><span>Channel access token</span><input className="input" value={token} autoComplete="off" placeholder="Channel access token (long-lived)" onChange={(e) => setToken(e.target.value.trim())} /></label>
          <div className="rn-acts">
            <button type="button" className="btn primary" disabled={secret.length < 32 || token.length < 100} onClick={async () => { if (await call({ action: 'line_save', secret, token })) { setSecret(''); setToken(''); setOpen(false); } }}>บันทึกและตั้ง Webhook</button>
            {line && <button type="button" className="btn ghost" onClick={() => setOpen(false)}>ปิด</button>}
          </div>
        </>}
        <label className="field" style={{ margin: 0 }}><span>Webhook URL</span>
          <span style={{ display: 'flex', gap: 6 }}><input className="input" readOnly value={webhook} style={{ fontFamily: 'ui-monospace, monospace' }} /><button type="button" className="btn ghost" aria-label="คัดลอก" onClick={() => copy(webhook)}>⧉</button></span>
          <small className="muted">ระบบตั้งให้อัตโนมัติตอนบันทึก ถ้าไม่สำเร็จให้คัดลอกไปวางใน LINE Developers › Messaging API › Webhook URL</small>
        </label>
      </div>
    </section>
  );
}

/** ตัวอย่างในแชท (เปลี่ยนตามที่ตั้งทันที) */
function Preview({ cfg, shop, sample }: { cfg: BotConfig; shop: Props['shop']; sample: Props['sample'] }) {
  const menu = cfg.menu.filter((m) => m.on && (m.key !== 'otp' || shop.otp) && (m.key !== 'renew' || shop.renew));
  const welcomeText = botText(cfg, 'welcome', { shop: shop.name, name: 'ลูกค้า' });
  const box = { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)' } as const;
  const lines = sample ? [`฿${sample.price.toLocaleString('th-TH')}`, cfg.card.sold && sample.sold > 0 && `ขายแล้ว ${sample.sold} ชิ้น`, cfg.card.stock && sample.left !== null && `เหลือ ${sample.left} ชิ้น`].filter(Boolean) : [];
  return (
    <div style={{ position: 'sticky', top: 16 }}>
      <small className="muted">ตัวอย่างในแชท</small>
      <div style={{ marginTop: 6, padding: 12, borderRadius: 22, background: '#8fa3c2', display: 'grid', gap: 10 }}>
        <div style={box}>
          <div style={{ background: '#1f2333', color: '#fff', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
            {cfg.card.logo && shop.logo && <img src={shop.logo} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />}
            <div><small style={{ color: '#ffb6c8', fontSize: 10 }}>ยินดีต้อนรับ</small><br /><b>{shop.name}</b></div>
          </div>
          <p style={{ margin: 0, padding: '12px 14px', fontSize: 13, whiteSpace: 'pre-wrap' }}>{welcomeText}</p>
          <div style={{ display: 'grid', gap: 6, padding: '0 12px 12px' }}>
            {menu.map((m, i) => (
              <div key={m.key} style={{ textAlign: 'center', padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: i === 0 ? shop.accent : '#f0f1f5', color: i === 0 ? '#fff' : '#333' }}>{MENU_ITEMS[m.key].icon} {MENU_ITEMS[m.key].label}</div>
            ))}
          </div>
        </div>
        {sample && (cfg.card.style === 'large' ? (
          <div style={box}>
            {sample.image ? <img src={sample.image} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} /> : <div style={{ aspectRatio: '1/1', background: '#e5e7ee' }} />}
            <div style={{ padding: '10px 14px' }}><b style={{ fontSize: 14 }}>{sample.name}</b>{lines.map((l) => <div key={String(l)} style={{ fontSize: 12, color: '#888' }}>{l}</div>)}</div>
            <div style={{ padding: '0 12px 12px' }}><div style={{ textAlign: 'center', padding: 8, borderRadius: 8, background: shop.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>เลือก</div></div>
          </div>
        ) : (
          <div style={box}>
            <div style={{ display: 'flex', gap: 10, padding: 12 }}>
              {sample.image ? <img src={sample.image} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 56, height: 56, borderRadius: 8, background: '#e5e7ee' }} />}
              <div style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{sample.name}</b>{lines.map((l) => <div key={String(l)} style={{ fontSize: 11, color: '#888' }}>{l}</div>)}</div>
            </div>
            <div style={{ padding: '0 12px 12px' }}><div style={{ textAlign: 'center', padding: 8, borderRadius: 8, background: shop.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>เลือก</div></div>
          </div>
        ))}
        {!cfg.enabled && <div style={{ ...box, padding: 10, fontSize: 12, textAlign: 'center', color: '#b91c1c' }}>บอทปิดอยู่ — จะไม่ตอบแชท</div>}
      </div>
    </div>
  );
}
