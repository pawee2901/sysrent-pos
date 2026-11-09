'use client';
import { to } from '@/lib/routes';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import { Delivered } from '@/components/Delivered';

export type ReportItem = {
  id: string; name: string; fulfillment: string; status: string; delivered: string;
  slot: SlotInfo | null;
};
type SlotInfo = { slotId: string; login: string; password: string; profile: string; pin: string; active: boolean };
export type AdminReport = { id: string; topic: string; message: string; image: string; status: string; reply: string; when: string; code: string; user: string; contact: string; items: ReportItem[] };

/** ลูกค้าแจ้งปัญหา: อ่าน · ดู / แก้ไอดีที่ส่งให้ลูกค้า · ตอบกลับ (ลูกค้าเห็นในหน้าประวัติ) · ปิดเรื่อง */
export function ReportsClient({ rows, enabled, ready }: { rows: AdminReport[]; enabled: boolean; ready: boolean }) {
  const router = useRouter();
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.id, r.reply])));
  const [busy, setBusy] = useState<string | null>(null);
  const open = rows.filter((r) => r.status === 'open').length;

  async function send(r: AdminReport, resolve: boolean) {
    setBusy(r.id);
    const res = await api('/api/admin/reports', { action: 'reply', id: r.id, reply: text[r.id] ?? '', resolve });
    setBusy(null);
    if (!res.ok) { notify(res.error, 'error'); return; }
    notify(resolve ? 'ปิดเรื่องแล้ว' : 'ส่งคำตอบแล้ว'); router.refresh();
  }

  return (
    <>
      <div className="page-head"><div><h1>แจ้งปัญหา</h1><p>{open ? `รอตอบ ${open} เรื่อง` : 'ไม่มีเรื่องค้าง 👍'} · แก้ไอดีให้ลูกค้าได้ในหน้านี้ · ลูกค้าเห็นคำตอบในหน้าประวัติ</p></div></div>
      {!enabled && <div className="card card-pad" style={{ marginBottom: 16 }}><b>🔒 ปุ่มแจ้งปัญหาเป็นฟีเจอร์ของแพ็กเกจ Pro (฿399/เดือน)</b><p className="muted" style={{ margin: '6px 0 0' }}>อัปเกรดแพ็กเกจที่ sysrent.shop แล้วลูกค้าจะเห็นปุ่ม &quot;⚠️ แจ้งปัญหา&quot; ในหน้าประวัติการซื้อ</p></div>}
      {!ready && <div className="card card-pad" style={{ marginBottom: 16 }}><b>⚠️ ต้องรัน SQL 0013_reports_slip_price.sql ก่อน</b></div>}
      {ready && !rows.length && <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>ยังไม่มีลูกค้าแจ้งปัญหา</p></div>}
      <div className="reports">{rows.map((r) => (
        <section key={r.id} className={`card report ${r.status}`}>
          <div className="report-head">
            <span className={`pill ${r.status === 'open' ? 'warn' : 'ok'}`}>{r.status === 'open' ? 'รอตอบ' : 'ปิดแล้ว'}</span>
            <b>{r.topic}</b>
            <span className="muted">{r.when}</span>
          </div>
          <div className="report-meta">
            <Link href={to(`/admin/orders?q=${r.code}`)}>ออเดอร์ #{r.code}</Link> · @{r.user}{r.contact && ` · ${r.contact}`}
          </div>
          {r.message && <p className="report-msg">{r.message}</p>}
          {r.image && <a href={r.image} target="_blank" rel="noopener noreferrer" className="report-img"><img src={r.image} alt="รูปที่ลูกค้าแนบ" /></a>}

          {r.items.length > 0 && (
            <div className="report-items">
              <span className="report-sub">📦 สินค้า / ไอดีที่ลูกค้าได้</span>
              {r.items.map((i) => <ItemBox key={i.id} item={i} onSaved={() => router.refresh()} />)}
            </div>
          )}

          <span className="report-sub">💬 ตอบลูกค้า</span>
          <textarea className="input" rows={2} maxLength={1000} placeholder="เช่น เปลี่ยนรหัสใหม่ให้แล้ว ลองเข้าใหม่อีกครั้งนะคะ" value={text[r.id] ?? ''} onChange={(e) => setText({ ...text, [r.id]: e.target.value })} />
          <div className="report-acts">
            <button type="button" className="btn sm" disabled={busy === r.id || !(text[r.id] ?? '').trim()} onClick={() => send(r, false)}>ส่งคำตอบ</button>
            {r.status === 'open' && <button type="button" className="btn primary sm" disabled={busy === r.id} onClick={() => send(r, true)}>✓ ตอบ + ปิดเรื่อง</button>}
          </div>
        </section>
      ))}</div>
    </>
  );
}

/** แบ่งจอ: ดู / แก้อีเมล รหัส โปรไฟล์ PIN ของจอที่ลูกค้าเช่าอยู่ */
function SlotBox({ item, slot: s, onSaved }: { item: ReportItem; slot: SlotInfo; onSaved: () => void }) {
  const [v, setV] = useState<Pick<SlotInfo, 'login' | 'password' | 'profile' | 'pin'> | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = !!v && (v.login.trim() !== s.login || v.password !== s.password || v.profile.trim() !== s.profile || v.pin.trim() !== s.pin);

  async function save() {
    if (!v) return;
    setBusy(true);
    // ส่งรหัสเฉพาะตอนแก้จริง — ค่าที่โชว์อาจเป็นข้อความ "(ถอดรหัสไม่ได้)"
    const r = await api('/api/admin/reports', { action: 'edit_slot', itemId: item.id, slotId: s.slotId, login: v.login, password: v.password === s.password ? '' : v.password, label: v.profile, pin: v.pin });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    setV(null); notify('แก้ข้อมูลแล้ว ลูกค้าเห็นของใหม่ทันที'); onSaved();
  }

  return (
    <div className="report-item">
      <div className="report-item-head"><b>{item.name}</b>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`pill ${s.active ? 'ok' : 'plain'}`}>{s.active ? 'ใช้งานอยู่' : 'หมดอายุ'}</span>
          {s.active && !v && <button type="button" className="btn sm" onClick={() => setV({ login: s.login, password: s.password, profile: s.profile, pin: s.pin })}>✏️ แก้ไข</button>}
        </span>
      </div>
      {v ? (
        <div className="report-edit">
          {([['login', 'อีเมล', 120], ['password', 'รหัสผ่าน', 200], ['profile', 'โปรไฟล์', 40], ['pin', 'PIN', 12]] as const).map(([k, label, max]) => (
            <label key={k} className="field"><span>{label}</span><input className="input" autoComplete="off" maxLength={max} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
          ))}
          <small style={{ color: 'var(--warn)' }}>⚠️ อีเมลและรหัสผ่านใช้ร่วมกันทุกจอในบัญชีนี้ แก้แล้วลูกค้าทุกคนในบัญชีนี้จะเห็นของใหม่ · โปรไฟล์และ PIN เปลี่ยนเฉพาะจอนี้</small>
          <div className="report-acts">
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setV(null)}>ยกเลิก</button>
            <button type="button" className="btn primary sm" disabled={busy || !changed || v.login.trim().length < 3 || !v.password || !v.profile.trim()} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          </div>
        </div>
      ) : <Delivered content={`อีเมล: ${s.login}\nรหัสผ่าน: ${s.password}\nโปรไฟล์: ${s.profile}${s.pin ? `\nPIN: ${s.pin}` : ''}`} />}
      <small className="faint">{s.active ? 'แบ่งจอ: รหัสใช้ร่วมกันทุกจอในบัญชีนี้ · ย้ายจอที่ ' : 'การเช่านี้หมดอายุแล้ว จอนี้อาจเป็นของลูกค้าคนอื่น · จัดการที่ '}<Link href={to('/admin/accounts')} style={{ color: 'var(--accent)', fontWeight: 600 }}>คลังบัญชี</Link></small>
    </div>
  );
}

/** 1 รายการในออเดอร์: ดูไอดี · แก้ไอดี (คลังโค้ด / สั่งทำ) · แบ่งจอ = SlotBox */
function ItemBox({ item, onSaved }: { item: ReportItem; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(item.delivered);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await api('/api/admin/reports', { action: 'edit_item', itemId: item.id, delivered: val });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    setEdit(false); notify('แก้ไอดีแล้ว ลูกค้าเห็นของใหม่ทันที'); onSaved();
  }

  if (item.slot) return <SlotBox item={item} slot={item.slot} onSaved={onSaved} />;
  return (
    <div className="report-item">
      <div className="report-item-head"><b>{item.name}</b>
        {item.status === 'delivered' && !edit && <button type="button" className="btn sm" onClick={() => { setVal(item.delivered); setEdit(true); }}>✏️ แก้ไขไอดี</button>}
      </div>
      {item.status !== 'delivered' ? <p className="muted" style={{ margin: 0, fontSize: 14 }}>ยังไม่ได้ส่งของ — ส่งที่หน้า <Link href={to('/admin/orders')} style={{ color: 'var(--accent)' }}>ออเดอร์</Link></p>
        : edit ? (
          <div className="report-edit">
            <textarea className="input" rows={Math.min(10, Math.max(3, val.split('\n').length + 1))} maxLength={4000} value={val} onChange={(e) => setVal(e.target.value)} />
            <small className="faint">พิมพ์แบบ <code>หัวข้อ: ค่า</code> ทีละบรรทัด เช่น <code>รหัสผ่าน: newpass123</code> ลูกค้าจะเห็นแยกช่อง + ปุ่มคัดลอก</small>
            <div className="report-acts">
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setEdit(false)}>ยกเลิก</button>
              <button type="button" className="btn primary sm" disabled={busy || !val.trim() || val.trim() === item.delivered.trim()} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึกไอดีใหม่'}</button>
            </div>
          </div>
        ) : <Delivered content={item.delivered} />}
    </div>
  );
}
