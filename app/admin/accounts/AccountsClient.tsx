'use client';
import { to } from '@/lib/routes';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { AppLogo } from '@/components/AppLogo';

type Slot = { id: string; label: string; pin: string; status: string; rent: { user: string; days: number } | null };
/** วันที่เหลือของบัญชี (เวลาไทย) · ไม่ตั้งวัน = null */
const daysLeft = (d: string | null) => (d ? Math.round((Date.parse(d) - Date.parse(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10))) / 86_400_000) : null);

export type Acc = { id: string; login: string; cost: number | null; renewAt: string | null; status: string; slots: Slot[] };
const ST: Record<string, string> = { free: 'ว่าง', used: 'มีคนเช่า', reset: 'รอเปลี่ยน PIN', broken: 'เสีย' };
const pin4 = () => String(Math.floor(1000 + Math.random() * 9000));

export function AccountsClient({ products, current, accounts, plans }: { products: { id: string; name: string }[]; current: { id: string; name: string; image: string; template: string }; accounts: Acc[]; plans: { name: string; days: number }[] }) {
  const router = useRouter();
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<{ id: string; login: string; password: string; cost: string; renew_at: string } | null>(null);
  const [f, setF] = useState({ login: '', password: '', cost: '', renew_at: '', count: '5', prefix: 'จอ' });
  const [slot, setSlot] = useState<(Slot & { accId: string }) | null>(null);
  const [pw, setPw] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const live = accounts.filter((a) => a.status === 'active');
  const all = live.flatMap((a) => a.slots);
  const cnt = (s: string) => all.filter((x) => x.status === s).length;

  async function call(b: object) {
    setBusy(true); setErr('');
    const r = await api<{ password?: string }>('/api/admin/accounts', b);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return null; }
    return r.data;
  }
  async function addAccount() {
    const n = Math.max(1, Math.min(20, Number(f.count) || 1));
    const ok = await call({ action: 'add', productId: current.id, login: f.login, password: f.password, cost: f.cost ? Number(f.cost) : null, renew_at: f.renew_at || null,
      slots: Array.from({ length: n }, (_, i) => ({ label: `${f.prefix || 'จอ'}-${i + 1}`, pin: pin4() })) });
    if (ok) { setAdd(false); setF({ ...f, login: '', password: '' }); router.refresh(); }
  }
  async function saveEdit() {
    if (!edit) return;
    const ok = await call({ action: 'edit', id: edit.id, login: edit.login, password: edit.password, cost: edit.cost ? Number(edit.cost) : null, renew_at: edit.renew_at || null });
    if (ok) { setPw({ ...pw, [edit.id]: '' }); setEdit(null); router.refresh(); }
  }
  async function reveal(id: string) {
    if (pw[id]) { setPw({ ...pw, [id]: '' }); return; }
    const r = await call({ action: 'reveal', id });
    if (r?.password) setPw({ ...pw, [id]: r.password });
  }

  return (
    <>
      <div className="page-head"><div><h1>คลังบัญชี</h1><p>บัญชีหลักที่ร้านซื้อมา แบ่งเป็นจอ · ขายแล้วระบบจัดจอให้อัตโนมัติ</p></div>
        <div className="acts"><button type="button" className="btn primary" onClick={() => setAdd(true)}>+ เพิ่มบัญชีหลัก</button></div></div>
      <div className="kpis">
        <div className="card kpi"><span className="lbl">จอว่าง</span><span className="val num">{accounts.filter((a) => a.status === 'active' && (daysLeft(a.renewAt) ?? 1) > 0).flatMap((a) => a.slots).filter((s) => s.status === 'free').length}</span><span className="delta mute">พร้อมขายตอนนี้</span></div>
        <div className="card kpi"><span className="lbl">มีคนเช่า</span><span className="val num">{cnt('used')}</span><span className="delta mute">{all.length ? Math.round((cnt('used') / all.length) * 100) : 0}% ของทั้งหมด</span></div>
        <div className="card kpi"><span className="lbl">รอเปลี่ยน PIN</span><span className="val num">{cnt('reset')}</span><span className={`delta${cnt('reset') ? ' down' : ' mute'}`}>{cnt('reset') ? 'เปลี่ยน PIN แล้วกด "พร้อมขาย"' : 'ไม่มีค้าง'}</span></div>
        <div className="card kpi"><span className="lbl">ต้นทุนรวม/รอบ</span><span className="val num">{baht(live.reduce((s, a) => s + (a.cost ?? 0), 0))}</span><span className="delta mute">{live.length} บัญชี</span></div>
      </div>
      {products.length > 1 && <div className="seg" style={{ marginBottom: 14, flexWrap: 'wrap' }}>{products.map((p) => <Link key={p.id} href={to(`/admin/accounts?p=${p.id}`)} className={p.id === current.id ? 'on' : ''} style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 8, fontSize: 13 }}>{p.name}</Link>)}</div>}
      {err && <p style={{ color: 'var(--bad)' }} role="alert">{err}</p>}

      {add && (
        <section className="card acc"><div className="card-head"><h3>เพิ่มบัญชีหลัก · {current.name}</h3><button type="button" className="btn ghost sm" onClick={() => setAdd(false)}>ยกเลิก</button></div>
          <div className="form">
            <div className="two"><label className="field"><span>อีเมล / ชื่อผู้ใช้ของบัญชี</span><input className="input" autoComplete="off" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} /></label>
              <label className="field"><span>รหัสผ่าน (เก็บแบบเข้ารหัส)</span><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label></div>
            <div className="two"><label className="field"><span>ต้นทุนต่อรอบ (บาท)</span><input className="input" inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value.replace(/[^\d.]/g, '') })} /></label>
              <label className="field"><span>วันหมดอายุบัญชี (ขายได้ถึงวันนี้)</span><input className="input" type="date" value={f.renew_at} onChange={(e) => setF({ ...f, renew_at: e.target.value })} /></label></div>
            <div className="two"><label className="field"><span>จำนวนจอ</span><input className="input" inputMode="numeric" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></label>
              <label className="field"><span>ชื่อโปรไฟล์ขึ้นต้นด้วย (PIN สุ่มให้ แก้ทีหลังได้)</span><input className="input" value={f.prefix} maxLength={20} onChange={(e) => setF({ ...f, prefix: e.target.value })} /></label></div>
            <button type="button" className="btn primary" disabled={busy || f.login.length < 3 || !f.password} onClick={addAccount}>{busy ? 'กำลังบันทึก…' : `บันทึก (${Math.max(1, Math.min(20, Number(f.count) || 1))} จอ)`}</button>
          </div>
        </section>
      )}

      {!accounts.length && !add && <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>ยังไม่มีบัญชีของ {current.name} — กด &quot;+ เพิ่มบัญชีหลัก&quot;</p></div>}
      {accounts.map((a) => {
        const days = daysLeft(a.renewAt);
        // แพ็กเกจที่บัญชีนี้ขายได้ตอนนี้ (เกณฑ์เดียวกับ shop_account_fits) · โชว์เฉพาะบัญชีที่ยังมีจอว่างและยังไม่หมดอายุ
        const fits = plans.filter((p) => days === null || p.days <= days);
        const showSell = a.status === 'active' && a.slots.some((s) => s.status === 'free') && (days === null || days > 0);
        return (
          <section key={a.id} className="card acc" style={{ opacity: a.status === 'active' ? 1 : .6 }}>
            <div className="acc-head"><AppLogo image={current.image} template={current.template} name={current.name} />
              <div className="grow"><b>{a.login}</b><small>{a.cost !== null ? `ต้นทุน ${baht(a.cost)} · ` : ''}{days !== null ? <span style={{ color: days <= 3 ? 'var(--bad)' : 'inherit', fontWeight: days <= 3 ? 600 : 400 }}>{days < 0 ? 'หมดอายุแล้ว · หยุดขาย' : days === 0 ? 'หมดอายุวันนี้ · หยุดขาย' : `เหลือ ${days} วัน · ขายแพ็กเกจไม่เกิน ${days} วัน`}</span> : 'ไม่ได้ตั้งวันหมดอายุ'}{a.status !== 'active' ? ` · ${a.status === 'broken' ? 'เสีย' : 'เลิกใช้'}` : ''}</small></div>
              <span className="pill ok">ใช้ {a.slots.filter((s) => s.status === 'used').length}/{a.slots.length} จอ</span>
              <button type="button" className="btn sm" onClick={() => reveal(a.id)}>{pw[a.id] ? 'ซ่อนรหัส' : '👁 ดูรหัส'}</button>
              {pw[a.id] && <code style={{ background: 'var(--surface-2)', padding: '4px 8px', borderRadius: 8 }}>{pw[a.id]}</code>}
              <button type="button" className="btn sm" onClick={() => setEdit({ id: a.id, login: a.login, password: '', cost: a.cost?.toString() ?? '', renew_at: a.renewAt ?? '' })}>✏️ แก้ไข</button>
              <button type="button" className="btn ghost sm" onClick={async () => { if (await call({ action: 'status', id: a.id, status: a.status === 'active' ? 'broken' : 'active' })) router.refresh(); }}>{a.status === 'active' ? 'ตั้งเป็นเสีย' : 'กลับมาใช้'}</button>
            </div>
            {edit?.id === a.id && (
              <div className="form">
                <div className="two"><label className="field"><span>อีเมล / ชื่อผู้ใช้ของบัญชี</span><input className="input" autoComplete="off" value={edit.login} onChange={(e) => setEdit({ ...edit, login: e.target.value })} /></label>
                  <label className="field"><span>รหัสผ่านใหม่</span><input className="input" type="password" autoComplete="new-password" placeholder="เว้นว่าง = ใช้รหัสเดิม" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></label></div>
                <div className="two"><label className="field"><span>ต้นทุนต่อรอบ (บาท)</span><input className="input" inputMode="decimal" value={edit.cost} onChange={(e) => setEdit({ ...edit, cost: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                  <label className="field"><span>วันหมดอายุบัญชี (เว้นว่าง = ไม่จำกัด)</span><input className="input" type="date" value={edit.renew_at} onChange={(e) => setEdit({ ...edit, renew_at: e.target.value })} /></label></div>
                <small style={{ color: 'var(--warn)' }}>⚠️ อีเมลและรหัสผ่านใช้ร่วมกันทุกจอ แก้แล้วลูกค้าทุกคนในบัญชีนี้จะเห็นของใหม่</small>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setEdit(null)}>ยกเลิก</button>
                  <button type="button" className="btn primary sm" disabled={busy || edit.login.trim().length < 3} onClick={saveEdit}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
                </div>
              </div>
            )}
            {showSell && (
              <div className={`acc-sell${fits.length ? '' : ' none'}`}>
                {fits.length
                  ? <>ขายได้ตอนนี้: <b>{fits.map((p) => p.name).join(' · ')}</b></>
                  : <>⚠️ จอว่างยังขายไม่ได้ เพราะทุกแพ็กเกจยาวกว่าวันที่เหลือ · <Link href={to('/admin/products')}>เพิ่มแพ็กเกจสั้น เช่น {Math.max(1, days ?? 1)} วัน</Link></>}
              </div>
            )}
            <div className="slots">{a.slots.map((s) => (
              <button key={s.id} type="button" className={`slot ${s.status}`} onClick={() => setSlot({ ...s, accId: a.id })} style={{ textAlign: 'left', font: 'inherit' }}>
                <b>{s.label}{s.pin ? ` · ${s.pin}` : ''}</b><span className="who">{s.rent ? `@${s.rent.user} · ${s.rent.days} วัน` : ST[s.status]}</span>
              </button>
            ))}</div>
          </section>
        );
      })}

      <div className={`drawer-bg${slot ? ' open' : ''}`} onClick={() => setSlot(null)} />
      <aside className={`drawer${slot ? ' open' : ''}`} aria-hidden={!slot}>
        {slot && <>
          <div className="drawer-head"><b style={{ flex: 1, fontSize: 17 }}>จอ {slot.label}</b><span className="pill">{ST[slot.status]}</span><button type="button" className="icon-btn" onClick={() => setSlot(null)} aria-label="ปิด">✕</button></div>
          <div className="drawer-body">
            {slot.rent && <p className="muted" style={{ margin: 0 }}>ผู้เช่า @{slot.rent.user} · เหลือ {slot.rent.days} วัน — ถ้าเปลี่ยน PIN ระหว่างเช่า ลูกค้าจะเห็น PIN ใหม่ที่หน้าบัญชีของฉัน</p>}
            <label className="field"><span>ชื่อโปรไฟล์</span><input className="input" value={slot.label} maxLength={40} onChange={(e) => setSlot({ ...slot, label: e.target.value })} /></label>
            <label className="field"><span>PIN</span><input className="input" value={slot.pin} maxLength={12} onChange={(e) => setSlot({ ...slot, pin: e.target.value })} /></label>
          </div>
          <div className="drawer-foot">
            {(slot.status === 'free' || slot.status === 'reset') && <button type="button" className="btn danger" disabled={busy} onClick={async () => { if (await call({ action: 'slot', slotId: slot.id, label: slot.label, pin: slot.pin, status: 'broken' })) { setSlot(null); router.refresh(); } }}>จอเสีย</button>}
            {slot.status === 'reset' || slot.status === 'broken'
              ? <button type="button" className="btn primary" disabled={busy} onClick={async () => { if (await call({ action: 'slot', slotId: slot.id, label: slot.label, pin: slot.pin, status: 'free' })) { setSlot(null); router.refresh(); } }}>เปลี่ยน PIN แล้ว → พร้อมขาย</button>
              : <button type="button" className="btn primary" disabled={busy} onClick={async () => { if (await call({ action: 'slot', slotId: slot.id, label: slot.label, pin: slot.pin })) { setSlot(null); router.refresh(); } }}>บันทึก</button>}
          </div>
        </>}
      </aside>
    </>
  );
}
