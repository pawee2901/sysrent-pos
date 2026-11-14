'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import { ThaiDateInput } from '@/components/ThaiDateInput';

export type RenewalView = {
  id: string; customerEmail: string; famEmail: string; optionId: string; option: string;
  lineUserId: string | null; lineName: string | null; code: string;
  expiresOn: string; left: number; deadline: string; fee: number;
  note: string; active: boolean; removed: boolean; reminded: boolean; renewed: number;
};
export type OptionGroup = { product: string; renew: boolean; options: { id: string; label: string }[] };
export type Contact = { id: string; name: string };
export type Fam = { email: string; used: number; members: string[] };
export type PendingPay = { id: string; label: string; amount: number; error: string; at: string; email: string; line: string };
type Settings = { remindDays: number; graceDays: number; lateFee: number; removedFee: number; famSize: number };
type Form = { id?: string; customer_email: string; fam_email: string; option_id: string; expires_on: string; line_user_id: string | null; note: string };

const dateTh = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
const plusDays = (n: number) => new Date(Date.now() + 7 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const codeMsg = (code: string) => `พิมพ์รหัส ${code} ในแชทนี้ เพื่อรับแจ้งเตือนและต่อเมลอัตโนมัติก่อนหมดอายุค่ะ`;
const copy = (t: string) => { navigator.clipboard?.writeText(t).then(() => notify('คัดลอกแล้ว', 'success')).catch(() => {}); };
/** fam ที่ควรใส่คนถัดไป: ยังว่าง และใส่ไปมากสุด (เติมให้เต็มทีละเมล) */
const autoFam = (fams: Fam[], size: number) => [...fams].filter((f) => f.used < size).sort((a, b) => b.used - a.used || a.email.localeCompare(b.email))[0]?.email ?? '';

function FamSelect({ value, onChange, fams, size, current = '' }: { value: string; onChange: (v: string) => void; fams: Fam[]; size: number; current?: string }) {
  const [typing, setTyping] = useState(Boolean(value) && !fams.some((f) => f.email === value));
  return (
    <>
      <select className="input" value={typing ? '__new' : value} onChange={(e) => { if (e.target.value === '__new') { setTyping(true); onChange(''); } else { setTyping(false); onChange(e.target.value); } }}>
        <option value="">— ไม่ระบุ —</option>
        {fams.map((f) => {
          const used = f.used - (f.email === current ? 1 : 0);
          const full = used >= size;
          return <option key={f.email} value={f.email} disabled={full && f.email !== current}>{f.email} · {used}/{size}{full ? ' เต็ม' : ` (ว่าง ${size - used})`}</option>;
        })}
        <option value="__new">+ เมลร้านใหม่…</option>
      </select>
      {typing && <input className="input" autoFocus value={value} maxLength={120} placeholder="พิมพ์เมลร้านใหม่ เช่น family04@gmail.com" onChange={(e) => onChange(e.target.value)} style={{ marginTop: 6 }} />}
    </>
  );
}

function ChatSelect({ value, onChange, contacts }: { value: string | null; onChange: (v: string | null) => void; contacts: Contact[] }) {
  const [q, setQ] = useState('');
  const match = (k: string) => (k ? contacts.filter((c) => c.name.toLowerCase().includes(k)) : contacts);
  const shown = useMemo(() => match(q.trim().toLowerCase()).slice(0, 200), [q, contacts]);   // eslint-disable-line react-hooks/exhaustive-deps
  const k = q.trim();
  return (
    <>
      <input className="input" placeholder="ค้นชื่อ LINE ลูกค้า" value={q} onChange={(e) => {
        setQ(e.target.value);
        const m = match(e.target.value.trim().toLowerCase());
        if (e.target.value.trim() && m.length === 1 && m[0].id !== value) onChange(m[0].id);   // เหลือคนเดียว → เลือกให้เลย
      }} />
      <select className="input" style={{ marginTop: 6 }} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— ยังไม่ผูก (ส่งรหัสให้ลูกค้าพิมพ์ใน LINE ร้าน) —</option>
        {value && !shown.some((c) => c.id === value) && <option value={value}>{contacts.find((c) => c.id === value)?.name ?? 'ลูกค้าที่เลือกไว้'}</option>}
        {shown.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {k && !shown.length && <small className="muted">ไม่พบ &quot;{k}&quot; — ระบบรู้จักเฉพาะคนที่เคยทัก LINE ร้าน (หลังเชื่อม LINE) · เว้นไว้แล้วส่งรหัสให้ลูกค้าพิมพ์แทนได้</small>}
    </>
  );
}

export function RenewalsClient({ rows, groups, contacts, pending, settings, fams, line, webhook, autoSlip, hasPromptpay }: {
  rows: RenewalView[]; groups: OptionGroup[]; contacts: Contact[]; pending: PendingPay[]; settings: Settings; fams: Fam[];
  line: { botName: string; basicId: string } | null; webhook: string; autoSlip: boolean; hasPromptpay: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState('');
  const [q, setQ] = useState('');

  async function call(body: object, confirmText?: string) {
    if (confirmText && !(await ask(confirmText, { ok: 'ยืนยัน' }))) return false;
    const r = await api<{ notice?: string; code?: string }>('/api/admin/renewals', body);
    if (!r.ok) { notify(r.error, 'error'); return false; }
    if (r.data.notice) notify(r.data.notice, 'success');
    router.refresh();
    return r.data;
  }
  async function save() {
    if (!f) return;
    setBusy(true); setMsg('');
    const { id, ...rest } = f;
    const r = await api<{ code?: string }>('/api/admin/renewals', id ? { action: 'update', id, ...rest } : { action: 'create', ...rest });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    if (!id && !f.line_user_id && r.data.code) setCode(r.data.code);
    setF(null); router.refresh();
  }
  const openNew = () => { setMsg(''); setF({ customer_email: '', fam_email: autoFam(fams, settings.famSize), option_id: groups.find((g) => g.renew)?.options[0]?.id ?? '', expires_on: plusDays(30), line_user_id: null, note: '' }); };
  const openEdit = (r: RenewalView) => { setMsg(''); setF({ id: r.id, customer_email: r.customerEmail, fam_email: r.famEmail, option_id: r.optionId, expires_on: r.expiresOn, line_user_id: r.lineUserId, note: r.note }); };

  const active = rows.filter((r) => r.active);
  const k = q.trim().toLowerCase();
  const shown = k ? rows.filter((r) => [r.customerEmail, r.famEmail, r.lineName ?? '', r.code, r.note].some((x) => x.toLowerCase().includes(k))) : rows;
  const editing = f?.id ? rows.find((r) => r.id === f.id) : undefined;

  return (
    <div className="rn">
      <div className="page-head"><div><h1>ต่อเมล</h1><p>ระบบเตือนลูกค้าทาง LINE ร้านก่อนหมด {settings.remindDays} วัน · ลูกค้าจ่ายในแชท · ต่อวันหมดอายุให้อัตโนมัติ</p></div>
        <div className="acts"><button type="button" className="btn primary" onClick={openNew}>+ เพิ่มลูกค้าต่อเมล</button></div></div>

      {(!line || !hasPromptpay) && (
        <div className="rn-alerts">
          {!line && <div className="rn-alert"><b>⚠️ ยังไม่ได้เชื่อม LINE OA ของร้าน</b><span>ระบบเตือนและรับเงินในแชทไม่ได้จนกว่าจะเชื่อม ดูกล่อง &quot;เชื่อม LINE OA ของร้าน&quot;</span></div>}
          {!hasPromptpay && <div className="rn-alert"><b>⚠️ ร้านยังไม่ได้ตั้งพร้อมเพย์</b><span>ตั้งที่ ตั้งค่าร้าน → รับเงิน ก่อน ลูกค้าถึงจะจ่ายในแชทได้</span></div>}
        </div>
      )}
      {code && (
        <div className="card rn-code">
          <div><b>ส่งข้อความนี้ให้ลูกค้าใน LINE ร้าน</b><p>{codeMsg(code)}</p></div>
          <div className="rn-acts"><button type="button" className="btn sm primary" onClick={() => copy(codeMsg(code))}>คัดลอกข้อความ</button><button type="button" className="btn sm ghost" onClick={() => setCode('')}>ปิด</button></div>
        </div>
      )}

      <div className="kpis">
        <div className="card kpi"><span className="lbl">ลูกค้าต่อเมล</span><span className="val num">{active.length}</span><span className="delta mute">ที่ยังต่ออยู่</span></div>
        <div className="card kpi"><span className="lbl">ใกล้หมด ({settings.remindDays} วัน)</span><span className="val num">{active.filter((r) => r.left >= 0 && r.left <= settings.remindDays).length}</span><span className="delta mute">ระบบเตือนทาง LINE เอง</span></div>
        <div className="card kpi"><span className="lbl">เลยกำหนด ยังไม่ลบเมล</span><span className="val num">{active.filter((r) => r.fee > 0 && !r.removed).length}</span><span className="delta mute">ลบออกจาก fam แล้วกด &quot;ลบเมลแล้ว&quot;</span></div>
        <div className="card kpi"><span className="lbl">ยังไม่ผูกแชท</span><span className="val num">{active.filter((r) => !r.lineUserId).length}</span><span className="delta mute">ส่งรหัสให้ลูกค้าพิมพ์</span></div>
      </div>

      <div className="rn-grid">
        <div className="rn-col">
          {pending.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>🧾 สลิปรอตรวจ ({pending.length})</h2></div>
              <p className="rn-sub">{autoSlip ? 'สลิปที่ตรวจอัตโนมัติไม่ผ่าน หรือโควตาตรวจสลิปหมด' : 'ระบบไม่มีบริการตรวจสลิปอัตโนมัติ'} — ตรวจยอดเงินเข้าบัญชีร้านเอง แล้วกดยืนยัน</p>
              {pending.map((p) => (
                <div key={p.id} className="rn-row rn-row-inline">
                  <div className="rn-who"><b>{p.email}</b><small>{p.line} · {p.label} · {baht(p.amount)} · {p.at}{p.error ? ` · ${p.error}` : ''}</small></div>
                  <button type="button" className="btn sm primary" onClick={() => call({ action: 'confirm_pay', id: p.id }, `ยืนยันว่าเงิน ${baht(p.amount)} เข้าบัญชีร้านแล้ว? ระบบจะต่ออายุและแจ้งลูกค้าทาง LINE`)}>ยืนยันรับเงิน</button>
                </div>
              ))}
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h2>รายชื่อ <span className="muted">({active.length})</span></h2>
              <input className="input rn-search" placeholder="🔍 ค้นเมล / ชื่อ LINE / รหัส" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {!shown.length && (
              <div className="rn-empty">
                <p>{rows.length ? 'ไม่พบรายการที่ค้น' : 'ยังไม่มีลูกค้าต่อเมล'}</p>
                {!rows.length && <button type="button" className="btn primary sm" onClick={openNew}>+ เพิ่มลูกค้าต่อเมล</button>}
              </div>
            )}
            {shown.map((r) => {
              const tone = !r.active ? 'plain' : r.removed || r.fee > 0 ? 'bad' : r.left <= settings.remindDays ? 'warn' : 'ok';
              const label = !r.active ? 'เลิกต่อแล้ว' : r.removed ? 'ลบเมลแล้ว' : r.fee > 0 ? `เลยกำหนด (+${r.fee})` : r.left < 0 ? `หมดแล้ว ${-r.left} วัน` : r.left === 0 ? 'หมดวันนี้' : `อีก ${r.left} วัน`;
              return (
                <div key={r.id} className="rn-row" style={{ opacity: r.active ? 1 : .6 }}>
                  <div className="rn-row-top">
                    <div className="rn-who"><b>{r.customerEmail}</b><small>{r.famEmail ? `fam: ${r.famEmail} · ` : ''}{r.option}</small></div>
                    <span className={`pill ${tone}`}>{label}</span>
                  </div>
                  <div className="rn-meta">
                    <span>📅 หมดอายุ {dateTh(r.expiresOn)} · ต่อราคาปกติได้ถึง {dateTh(r.deadline)}{r.renewed > 0 ? ` · ต่อผ่านระบบ ${r.renewed} ครั้ง` : ''}{r.reminded && r.active ? ' · เตือนรอบนี้แล้ว' : ''}</span>
                    <span>💬 LINE: {r.lineName ? <b>{r.lineName}</b> : <>ยังไม่ผูก · รหัส <b style={{ userSelect: 'all' }}>{r.code}</b> <button type="button" className="rn-link" onClick={() => copy(codeMsg(r.code))}>คัดลอกข้อความให้ลูกค้า</button></>}</span>
                    {r.note && <span>📝 {r.note}</span>}
                  </div>
                  <div className="rn-acts">
                    <button type="button" className="btn sm" onClick={() => openEdit(r)}>แก้ไข</button>
                    {r.active && <button type="button" className="btn sm ghost" disabled={!r.lineUserId || !line} onClick={() => call({ action: 'remind', id: r.id })}>ส่งเตือนทาง LINE ตอนนี้</button>}
                    {r.active && !r.removed && <button type="button" className="btn sm ghost" onClick={() => call({ action: 'removed', id: r.id, removed: true }, `ลบเมล ${r.customerEmail} ออกจาก fam แล้ว? ถ้าลูกค้ามาต่อทีหลังจะคิด +${settings.removedFee} บาท และระบบจะแจ้งให้เพิ่มเมลกลับ`)}>ลบเมลแล้ว</button>}
                    {r.active && r.removed && <button type="button" className="btn sm ghost" onClick={() => call({ action: 'removed', id: r.id, removed: false })}>ยังอยู่ใน fam</button>}
                    {r.active
                      ? <button type="button" className="btn sm ghost" onClick={() => call({ action: 'status', id: r.id, active: false }, `เลิกต่อ ${r.customerEmail}? ระบบจะไม่เตือนอีก`)}>เลิกต่อ</button>
                      : <><button type="button" className="btn sm ghost" onClick={() => call({ action: 'status', id: r.id, active: true })}>กลับมาต่อ</button>
                        <button type="button" className="btn sm ghost" onClick={() => call({ action: 'delete', id: r.id }, `ลบ ${r.customerEmail} ถาวร?`)}>ลบ</button></>}
                  </div>
                </div>
              );
            })}
          </section>

          {fams.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>เมลร้าน (fam) · {fams.length} เมล</h2><span className="pill ok">ว่างรวม {fams.reduce((n, x) => n + Math.max(0, settings.famSize - x.used), 0)} ที่</span></div>
              {fams.map((x) => (
                <details key={x.email} className="rn-fam">
                  <summary><span>{x.email}</span><span className={`pill ${x.used >= settings.famSize ? 'bad' : 'ok'}`}>{x.used}/{settings.famSize}</span></summary>
                  <small className="muted">{x.members.length ? x.members.join(' · ') : 'ยังไม่มีลูกค้า'}</small>
                </details>
              ))}
            </section>
          )}
        </div>

        <div className="rn-col">
          <LineCard line={line} webhook={webhook} call={call} />
          <SettingsCard settings={settings} call={call} />
        </div>
      </div>

      <div className={`drawer-bg${f ? ' open' : ''}`} onClick={() => setF(null)} />
      <aside className={`drawer${f ? ' open' : ''}`} aria-hidden={!f}>
        {f && <>
          <div className="drawer-head"><b style={{ flex: 1, fontSize: 17 }}>{f.id ? 'แก้ไขลูกค้าต่อเมล' : 'เพิ่มลูกค้าต่อเมล'}</b><button type="button" className="icon-btn" onClick={() => setF(null)} aria-label="ปิด">✕</button></div>
          <div className="drawer-body">
            <label className="field"><span>เมลลูกค้า (เมลที่ต่อ)</span><input className="input" value={f.customer_email} maxLength={120} placeholder="customer@gmail.com" onChange={(e) => setF({ ...f, customer_email: e.target.value })} /></label>
            <div className="field"><span>เมลร้านที่ลูกค้าอยู่ (fam)</span><FamSelect value={f.fam_email} onChange={(v) => setF({ ...f, fam_email: v })} fams={fams} size={settings.famSize} current={editing && !editing.removed ? editing.famEmail : ''} /></div>
            <label className="field"><span>แพ็กเกจต่อ (ราคาที่ลูกค้าจ่าย)</span>
              <select className="input" value={f.option_id} onChange={(e) => setF({ ...f, option_id: e.target.value })}>
                <option value="">— เลือกแพ็กเกจ —</option>
                {groups.map((g) => <optgroup key={g.product} label={g.product}>{g.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>)}
              </select></label>
            <div className="field"><span>หมดอายุวันที่</span><ThaiDateInput value={f.expires_on} onChange={(v) => setF({ ...f, expires_on: v })} clearable={false} label="หมดอายุวันที่" /></div>
            <div className="field"><span>แชท LINE ของลูกค้า</span><ChatSelect value={f.line_user_id} onChange={(v) => setF({ ...f, line_user_id: v })} contacts={contacts} /></div>
            <label className="field"><span>หมายเหตุ (ไม่บังคับ)</span><input className="input" value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            {msg && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{msg}</p>}
          </div>
          <div className="drawer-foot"><button type="button" className="btn primary" disabled={busy || f.customer_email.trim().length < 3 || !f.option_id || !f.expires_on} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>
        </>}
      </aside>
    </div>
  );
}

/** เชื่อม LINE OA ของร้าน: วิธีทำ + ช่องใส่รหัส + ทดสอบ */
function LineCard({ line, webhook, call }: { line: { botName: string; basicId: string } | null; webhook: string; call: (b: object, c?: string) => Promise<unknown> }) {
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [open, setOpen] = useState(!line);
  return (
    <section className="card">
      <div className="card-head">
        <h2>เชื่อม LINE OA ของร้าน</h2>
        {line ? <span className="pill ok">เชื่อมแล้ว · {line.botName} {line.basicId}</span> : <span className="pill warn">ยังไม่เชื่อม</span>}
      </div>
      <div className="rn-body">
        {line && !open && (
          <div className="rn-acts">
            <button type="button" className="btn sm primary" onClick={() => call({ action: 'line_test' })}>ทดสอบการเชื่อมต่อ</button>
            <button type="button" className="btn sm ghost" onClick={() => setOpen(true)}>เปลี่ยนรหัส / วิธีตั้งค่า</button>
            <button type="button" className="btn sm ghost" onClick={() => call({ action: 'line_delete' }, 'ยกเลิกการเชื่อม LINE? ระบบจะหยุดเตือนและรับเงินในแชท')}>ยกเลิกการเชื่อม</button>
          </div>
        )}
        {open && <>
          <ol className="rn-steps">
            <li>LINE OA Manager (บัญชีร้าน) → ⚙ ตั้งค่า → <b>Messaging API</b> → <b>ใช้ Messaging API</b></li>
            <li>ช่อง <b>Webhook URL</b> ใส่ลิงก์นี้ แล้วบันทึก
              <span className="rn-copy"><code>{webhook}</code><button type="button" className="btn sm" onClick={() => copy(webhook)}>คัดลอก</button></span></li>
            <li>ตั้งค่าการตอบกลับ: <b>แชท เปิด · Webhook เปิด</b> · ข้อความตอบกลับอัตโนมัติ <b>ปิด</b> (ไม่งั้นตอบซ้อนกับระบบ)</li>
            <li>developers.line.biz → ช่องของร้าน → <b>Basic settings</b> → คัดลอก <b>Channel secret</b> · แท็บ <b>Messaging API</b> → <b>Channel access token</b> กด Issue แล้วคัดลอก</li>
            <li>วางทั้ง 2 ค่าด้านล่าง → บันทึก → กด &quot;ทดสอบการเชื่อมต่อ&quot;</li>
          </ol>
          <label className="field"><span>Channel secret</span><input className="input" value={secret} maxLength={64} autoComplete="off" placeholder="ตัวอักษร 32 ตัว" onChange={(e) => setSecret(e.target.value.trim())} /></label>
          <label className="field"><span>Channel access token (long-lived)</span><textarea className="input" rows={3} value={token} autoComplete="off" placeholder="วาง token ยาวที่กด Issue มา" onChange={(e) => setToken(e.target.value.trim())} /></label>
          <div className="rn-acts">
            <button type="button" className="btn primary" disabled={secret.length < 32 || token.length < 100} onClick={async () => { if (await call({ action: 'line_save', secret, token })) { setSecret(''); setToken(''); setOpen(false); } }}>บันทึก</button>
            {line && <button type="button" className="btn ghost" onClick={() => setOpen(false)}>ปิด</button>}
          </div>
          <p className="rn-note">🔒 รหัสเก็บแบบเข้ารหัส · ระบบตอบในแชทเฉพาะเรื่องต่อเมล (รหัสผูก R12345 · พิมพ์ &quot;ต่อเมล&quot; · ปุ่มแพ็กเกจ · สลิป) ข้อความอื่นร้านตอบเองตามปกติ</p>
        </>}
      </div>
    </section>
  );
}

function SettingsCard({ settings, call }: { settings: Settings; call: (b: object) => Promise<unknown> }) {
  const [s, setS] = useState({ remind: String(settings.remindDays), grace: String(settings.graceDays), late: String(settings.lateFee), removed: String(settings.removedFee), fam: String(settings.famSize) });
  const n = (v: string) => Number(v.replace(/[^\d.]/g, '') || 0);
  const box = (label: string, key: keyof typeof s, unit: string) => (
    <label className="field"><span>{label}</span><div className="rn-unit"><input className="input" inputMode="decimal" value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} /><i>{unit}</i></div></label>
  );
  return (
    <section className="card">
      <div className="card-head"><h2>ตั้งค่าการต่อ</h2></div>
      <div className="rn-body">
        <div className="rn-fields">
          {box('เตือนก่อนหมดอายุ', 'remind', 'วัน')}
          {box('ต่อราคาปกติได้ถึง วันหมด +', 'grace', 'วัน')}
          {box('ต่อหลังจากนั้น บวกเพิ่ม', 'late', 'บาท')}
          {box('ต่อหลังลบเมลแล้ว บวกเพิ่ม', 'removed', 'บาท')}
          {box('1 เมลร้าน (fam) ใส่ลูกค้าได้', 'fam', 'เมล')}
        </div>
        <p className="rn-note">💡 ตัวอย่าง: หมดอายุวันที่ 17 · ต่อราคาปกติได้ถึงวันที่ {17 + n(s.grace)} · หลังจากนั้น +{n(s.late)} บาท · กด &quot;ลบเมลแล้ว&quot; +{n(s.removed)} บาท (ขึ้นในการ์ดเตือนลูกค้าด้วย)</p>
        <div className="rn-acts"><button type="button" className="btn primary" onClick={() => call({ action: 'settings', remind_days: Math.max(1, Math.round(n(s.remind))), grace_days: Math.round(n(s.grace)), late_fee: n(s.late), removed_fee: n(s.removed), fam_size: Math.max(1, Math.round(n(s.fam))) })}>บันทึกการตั้งค่า</button></div>
      </div>
    </section>
  );
}
