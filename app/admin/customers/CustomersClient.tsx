'use client';
import { to } from '@/lib/routes';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ask, input, notify } from '@/components/dialog';
import { PermDialog } from './PermDialog';
import type { Perm } from '@/lib/perms';
import { api, baht } from '@/components/Cart';

export type Role = 'customer' | 'agent' | 'admin';
type C = { id: string; username: string; contact: string; balance: number; blocked: boolean; joined: string; orders: number; spent: number; role: Role; perms: Perm[] };
const ROLE_LABEL: Record<Role, string> = { customer: '👤 ลูกค้าทั่วไป', agent: '🤝 ตัวแทน', admin: '🛡️ แอดมิน' };

/** ลูกค้า: ค้นหา · ปรับยอดกระเป๋า (ต้องใส่เหตุผล) · ระงับ · ตั้งรหัสผ่านใหม่ */
export function CustomersClient({ rows, total, q, owner, agentsOn, rolesReady, staffOn, exportOn }: { rows: C[]; total: number; q: string; owner: boolean; agentsOn: boolean; rolesReady: boolean; staffOn: boolean; exportOn: boolean }) {
  const router = useRouter();
  const [permFor, setPermFor] = useState<{ c: C; isNew: boolean } | null>(null);
  const [add, setAdd] = useState<{ username: string; password: string; contact: string; email: string } | null>(null);
  const [saving, setSaving] = useState(false);
  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!add) return;
    setSaving(true);
    const ok = await run({ action: 'create', ...add }, `เพิ่ม @${add.username} แล้ว แจ้งชื่อผู้ใช้และรหัสผ่านให้ลูกค้าได้เลย`);
    setSaving(false);
    if (ok) setAdd(null);
  }
  async function run(body: object, ok: string): Promise<boolean> {
    const r = await api('/api/admin/customers', body);
    if (!r.ok) { notify(r.error, 'error'); return false; }
    notify(ok); router.refresh(); return true;
  }
  async function adjust(c: C) {
    const v = await input(`ปรับยอดกระเป๋า @${c.username}`, {
      text: `คงเหลือ ${baht(c.balance)} · ใส่จำนวน เช่น 100 (เติม) หรือ -50 (หัก)`, placeholder: 'เช่น 100 หรือ -50', ok: 'ถัดไป',
      check: (s) => (Number.isFinite(Number(s)) && Number(s) !== 0 && Math.abs(Number(s)) <= 100000 ? null : 'จำนวนไม่ถูกต้อง'),
    });
    if (!v) return;
    const amount = Number(v);
    const note = await input(amount > 0 ? `เติม ${baht(amount)} ให้ @${c.username}` : `หัก ${baht(-amount)} จาก @${c.username}`, {
      text: 'เหตุผล (บันทึกในประวัติลูกค้า)', value: amount > 0 ? 'ร้านเติมเงินให้' : 'ร้านหักยอด', ok: 'ยืนยัน',
    });
    if (!note) return;
    run({ action: 'adjust', id: c.id, amount, note }, 'ปรับยอดแล้ว');
  }
  /** เปลี่ยนยศ (แอดมิน = เข้าหลังบ้านได้ → ยืนยันก่อน) */
  async function setRole(c: C, role: Role) {
    if (role === c.role) return;
    if (role === 'admin') { setPermFor({ c, isNew: true }); return; } // เลือกเมนูที่เข้าได้ก่อน แล้วค่อยตั้งยศ
    if (c.role === 'admin' && !(await ask(`ถอด @${c.username} ออกจากแอดมิน?`, { text: 'คนนี้จะเข้าหลังบ้านไม่ได้อีก', ok: 'ถอดยศ', danger: true }))) return;
    run({ action: 'role', id: c.id, role }, `เปลี่ยนยศ @${c.username} เป็น${ROLE_LABEL[role].replace(/^\S+\s/, '')}แล้ว`);
  }
  async function resetPw(c: C) {
    const p = await input(`ตั้งรหัสผ่านใหม่ให้ @${c.username}`, {
      text: 'ตั้งแล้วแจ้งลูกค้าทาง LINE', placeholder: 'อย่างน้อย 6 ตัว', ok: 'ตั้งรหัสผ่าน', max: 72,
      check: (s) => (s.length >= 6 ? null : 'รหัสผ่านอย่างน้อย 6 ตัว'),
    });
    if (p) run({ action: 'password', id: c.id, password: p }, 'ตั้งรหัสผ่านใหม่แล้ว');
  }
  return (
    <>
      <div className="page-head"><div><h1>ลูกค้า</h1><p>{total.toLocaleString('th-TH')} คน · ปรับยศ · ปรับยอดเงิน · ระงับ · ตั้งรหัสผ่านใหม่{rolesReady ? '' : ' · ⚠️ รัน SQL 0017 เพื่อเปิดการตั้งยศ'}</p>{agentsOn && <p className="faint" style={{ fontSize: 13, marginTop: 2 }}>🤝 ตั้งยศเป็นตัวแทนแล้ว จะย้ายไปอยู่ในเมนู <a href={to('/admin/agents')} style={{ color: 'var(--accent)', fontWeight: 600 }}>ตัวแทน</a></p>}</div>
        <div className="acts"><button type="button" className="btn primary" onClick={() => setAdd({ username: '', password: '', contact: '', email: '' })}>+ เพิ่มลูกค้า</button>{exportOn ? <a href="/api/admin/export?type=customers" className="btn">⬇ ส่งออก Excel</a> : <a href="https://sysrent.shop" target="_blank" rel="noopener noreferrer" className="btn">🔒 Excel (Max)</a>}</div></div>
      <section className="card">
        <form className="toolbar" action={to('/admin/customers')}><input className="input" name="q" defaultValue={q} placeholder="🔍 ชื่อผู้ใช้ / LINE / เบอร์" /></form>
        {!rows.length ? <p className="muted card-pad" style={{ margin: 0 }}>ไม่พบลูกค้า</p> : (
          <table className="tbl ctbl">
            <thead><tr><th>ลูกค้า</th><th>ติดต่อ</th><th className="r">กระเป๋า</th><th className="r">ซื้อแล้ว</th><th>ยศ</th><th>จัดการ</th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id} style={{ cursor: 'default', opacity: c.blocked ? .55 : 1 }}>
                <td className="c-user"><b>@{c.username}</b> {c.blocked && <span className="pill bad">ระงับ</span>}<small>สมัคร {c.joined}</small></td>
                <td className="c-contact">{c.contact || <span className="faint">ไม่ได้ใส่ช่องทางติดต่อ</span>}</td>
                <td className="r num c-bal"><b>{baht(c.balance)}</b></td>
                <td className="r num c-ord">ซื้อ {c.orders} ครั้ง<small>{baht(c.spent)}</small></td>
                <td className="c-role">
                  <select className={`input role-select role-${c.role}`} value={c.role} disabled={!rolesReady} aria-label={`ยศของ @${c.username}`} onChange={(e) => setRole(c, e.target.value as Role)}>
                    <option value="customer">{ROLE_LABEL.customer}</option>
                    <option value="agent" disabled={!agentsOn && c.role !== 'agent'}>{ROLE_LABEL.agent}{agentsOn ? '' : ' (Pro)'}</option>
                    <option value="admin" disabled={(!owner || !staffOn) && c.role !== 'admin'}>{ROLE_LABEL.admin}{!staffOn ? ' (Max)' : owner ? '' : ' (เจ้าของร้านเท่านั้น)'}</option>
                  </select>
                  {c.role === 'admin' && owner && <button type="button" className="perm-btn" onClick={() => setPermFor({ c, isNew: false })}>🔑 สิทธิ์ {c.perms.length ? `(${c.perms.length} เมนู)` : ''}</button>}</td>
                <td className="c-act"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn sm" onClick={() => adjust(c)}>ปรับยอด</button>
                  <button type="button" className="btn ghost sm" onClick={() => resetPw(c)}>รหัสผ่าน</button>
                  <button type="button" className={`btn ghost sm${c.blocked ? '' : ' danger'}`} onClick={() => run({ action: 'block', id: c.id, blocked: !c.blocked }, c.blocked ? 'ยกเลิกระงับแล้ว' : 'ระงับแล้ว')}>{c.blocked ? 'ยกเลิกระงับ' : 'ระงับ'}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
      {add && (
        <div className="cmd-bg open" onClick={(e) => { if (e.target === e.currentTarget && !saving) setAdd(null); }}>
          <form className="card cmd" role="dialog" aria-label="เพิ่มลูกค้า" onSubmit={createCustomer} style={{ padding: 18, display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>เพิ่มลูกค้า</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>สมัครสมาชิกให้ลูกค้า ลูกค้าใช้ชื่อผู้ใช้และรหัสผ่านนี้เข้าสู่ระบบได้ทันที</p>
            <label className="field"><span>ชื่อผู้ใช้</span><input className="input" required autoFocus autoComplete="off" maxLength={20} placeholder="a-z, 0-9, _ ยาว 3–20 ตัว" value={add.username} onChange={(e) => setAdd({ ...add, username: e.target.value.toLowerCase() })} /></label>
            <label className="field"><span>รหัสผ่าน</span><input className="input" required autoComplete="new-password" minLength={6} maxLength={72} placeholder="อย่างน้อย 6 ตัว" value={add.password} onChange={(e) => setAdd({ ...add, password: e.target.value })} /></label>
            <label className="field"><span>ช่องทางติดต่อ (ไม่บังคับ)</span><input className="input" autoComplete="off" maxLength={60} placeholder="LINE / เบอร์โทร" value={add.contact} onChange={(e) => setAdd({ ...add, contact: e.target.value })} /></label>
            <label className="field"><span>อีเมล (ไม่บังคับ)</span><input className="input" type="email" autoComplete="off" maxLength={120} placeholder="ใช้แจ้งเตือนเมื่อร้านส่งของ" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn ghost" disabled={saving} onClick={() => setAdd(null)}>ยกเลิก</button>
              <button type="submit" className="btn primary" disabled={saving || !/^[a-z0-9_]{3,20}$/.test(add.username.trim()) || add.password.length < 6}>{saving ? 'กำลังเพิ่ม…' : 'เพิ่มลูกค้า'}</button>
            </div>
          </form>
        </div>
      )}
      {permFor && (
        <PermDialog username={permFor.c.username} initial={permFor.c.perms} isNew={permFor.isNew} onClose={() => setPermFor(null)}
          onSave={(perms) => permFor.isNew
            ? run({ action: 'role', id: permFor.c.id, role: 'admin', perms }, `ตั้ง @${permFor.c.username} เป็นแอดมินแล้ว`)
            : run({ action: 'perms', id: permFor.c.id, perms }, 'บันทึกสิทธิ์แล้ว')} />
      )}
    </>
  );
}
