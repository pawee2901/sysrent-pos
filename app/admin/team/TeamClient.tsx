'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import { to } from '@/lib/routes';
import { PERMS, DEFAULT_STAFF_PERMS, type Perm } from '@/lib/perms';
import { PermDialog } from '../customers/PermDialog';

export type Member = { id: string; username: string; contact: string; blocked: boolean; since: string; perms: Perm[]; seen: string };

const label = (k: Perm) => PERMS.find((p) => p.key === k)?.label ?? k;

/** ทีมงาน / แอดมิน: เพิ่มจากบัญชีสมาชิก (หรือสร้างบัญชีให้) · เลือกเมนูที่เข้าได้ · เอาออก */
export function TeamClient({ members, owner, enabled, ready }: { members: Member[]; owner: boolean; enabled: boolean; ready: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [perms, setPerms] = useState<Perm[]>(DEFAULT_STAFF_PERMS);
  const [pick, setPick] = useState(false);
  const [edit, setEdit] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  useEffect(() => setLink(`${window.location.origin}${to('/admin')}`), []);
  const can = owner && enabled && ready;

  async function run(body: object, ok: string) {
    setBusy(true);
    const r = await api('/api/admin/customers', body);
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return false; }
    notify(ok); router.refresh(); return true;
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const u = user.trim().replace(/^@/, '').toLowerCase();
    if (await run({ action: 'staff_add', username: u, password: isNew ? pass : '', name, perms }, `เพิ่ม @${u} เข้าทีมแล้ว`)) {
      setUser(''); setName(''); setPass(''); setPerms(DEFAULT_STAFF_PERMS);
    }
  }
  async function remove(m: Member) {
    if (await ask(`เอา @${m.username} ออกจากทีม?`, { text: 'คนนี้จะเข้าหลังบ้านไม่ได้อีก บัญชีกลับเป็นลูกค้าธรรมดา (ยังซื้อของได้)', ok: 'เอาออก', danger: true }))
      run({ action: 'role', id: m.id, role: 'customer' }, `เอา @${m.username} ออกจากทีมแล้ว`);
  }
  const copy = () => navigator.clipboard?.writeText(`เข้าหลังบ้านร้านที่ ${link}\nล็อกอินด้วยบัญชีสมาชิกร้านของตัวเอง`).then(() => notify('คัดลอกแล้ว', 'success')).catch(() => {});

  return (
    <div className="tm">
      <div className="page-head"><div><h1>ทีมงาน</h1><p>{members.length ? `${members.length} คนช่วยดูแลร้าน · เห็นเฉพาะเมนูที่คุณเลือกให้` : 'ให้คนในทีมช่วยตอบลูกค้า ส่งของ ดูออเดอร์ โดยไม่ต้องให้รหัสหลังบ้านของร้าน'}</p></div></div>
      {!enabled && <div className="card card-pad" style={{ marginBottom: 16 }}><b>🔒 แพ็กเกจของร้านยังไม่มีระบบทีมงาน</b><p className="muted" style={{ margin: '6px 0 0' }}>ติดต่อ sysrent.shop เพื่อเปิดใช้งาน</p></div>}
      {!ready && <div className="card card-pad" style={{ marginBottom: 16 }}><b>⚠️ ต้องรัน SQL 0017_customer_roles.sql และ 0018_admin_perms.sql ก่อน</b></div>}
      {!owner && <div className="card card-pad" style={{ marginBottom: 16 }}><b>🔒 เพิ่ม / แก้ทีมงานได้เฉพาะเจ้าของร้าน</b><p className="muted" style={{ margin: '6px 0 0' }}>ล็อกอินด้วยบัญชีหลังบ้านของร้าน</p></div>}

      <div className="tm-grid">
        <section className="card">
          <div className="card-head"><h2>➕ เพิ่มคนในทีม</h2></div>
          <form className="form" onSubmit={add}>
            <div className="tm-mode" role="radiogroup" aria-label="บัญชีของทีมงาน">
              <button type="button" role="radio" aria-checked={!isNew} className={!isNew ? 'on' : ''} onClick={() => setIsNew(false)}>👤 มีบัญชีสมาชิกแล้ว<small>ใช้ชื่อผู้ใช้ที่สมัครไว้</small></button>
              <button type="button" role="radio" aria-checked={isNew} className={isNew ? 'on' : ''} onClick={() => setIsNew(true)}>✨ สร้างบัญชีให้<small>ตั้งชื่อ + รหัสผ่านให้เลย</small></button>
            </div>
            <div className="two">
              <label className="field"><span>ชื่อผู้ใช้ <em className="tm-req">*</em></span><input className="input" value={user} maxLength={21} autoCapitalize="off" placeholder={isNew ? 'เช่น admin_mook' : 'เช่น pawee2080'} onChange={(e) => setUser(e.target.value)} disabled={!can} /></label>
              {isNew
                ? <label className="field"><span>รหัสผ่าน <em className="tm-req">*</em></span><input className="input" type="text" value={pass} maxLength={72} autoComplete="new-password" placeholder="อย่างน้อย 6 ตัว" onChange={(e) => setPass(e.target.value)} disabled={!can} /></label>
                : <div className="field"><span>&nbsp;</span><small className="faint" style={{ alignSelf: 'center' }}>ให้ทีมงานสมัครสมาชิกที่หน้าร้านก่อน แล้วบอกชื่อผู้ใช้มา</small></div>}
            </div>
            {isNew && <label className="field"><span>ชื่อเล่น / ช่องทางติดต่อ (ไม่บังคับ)</span><input className="input" value={name} maxLength={60} placeholder="เช่น น้องมุก · LINE mook99" onChange={(e) => setName(e.target.value)} disabled={!can} /></label>}
            <div className="field"><span>เมนูที่เข้าได้</span>
              <button type="button" className="tm-perms" onClick={() => setPick(true)} disabled={!can}>
                <span>{perms.map((k) => <i key={k}>{label(k)}</i>)}</span><b>🔑 เลือกเมนู ({perms.length})</b></button></div>
            <button type="submit" className="btn primary" disabled={busy || !can || user.trim().length < 3 || (isNew && pass.length < 6)}>{busy ? 'กำลังเพิ่ม…' : '+ เพิ่มเข้าทีม'}</button>
          </form>
        </section>

        <section className="card tm-how">
          <div className="card-head"><h2>📨 ทีมงานเข้าหลังบ้านยังไง</h2></div>
          <ol>
            <li>ล็อกอินที่หน้าร้านด้วย<b>บัญชีสมาชิกของตัวเอง</b></li>
            <li>เปิดลิงก์หลังบ้านนี้ (หรือกดเมนู &quot;หลังบ้านร้าน&quot; ที่รูปโปรไฟล์)</li>
          </ol>
          <div className="rn-copy"><code>{link || '…'}</code><button type="button" className="btn sm" onClick={copy}>คัดลอก</button></div>
          <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>🔒 ทีมงานทำไม่ได้เสมอ: เพิ่ม / เอาคนออกจากทีม · แก้สิทธิ์ · เปลี่ยนรหัสหลังบ้านของร้าน</p>
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>คนในทีม <span className="muted">({members.length})</span></h2></div>
        {!members.length && <div className="rn-empty"><p>ยังไม่มีคนในทีม · เพิ่มคนแรกด้านบนได้เลย</p></div>}
        {members.map((m) => (
          <div key={m.id} className="tm-row" style={{ opacity: m.blocked ? .55 : 1 }}>
            <span className="tm-av">{m.username.slice(0, 1).toUpperCase()}</span>
            <div className="tm-main">
              <b>@{m.username}{m.contact && <span className="muted"> · {m.contact}</span>}</b>
              <small>เข้าทีม {m.since}{m.seen ? ` · ล็อกอินล่าสุด ${m.seen}` : ' · ยังไม่เคยล็อกอิน'}{m.blocked ? ' · ⛔ ถูกระงับ' : ''}</small>
              <div className="tm-tags">{(m.perms.length ? m.perms : DEFAULT_STAFF_PERMS).map((k) => <i key={k}>{label(k)}</i>)}</div>
            </div>
            {owner && <div className="tm-acts">
              <button type="button" className="btn sm" disabled={busy} onClick={() => setEdit(m)}>🔑 สิทธิ์</button>
              <button type="button" className="btn sm ghost" disabled={busy} onClick={() => remove(m)}>เอาออก</button>
            </div>}
          </div>
        ))}
      </section>

      {pick && <PermDialog username={user.trim().replace(/^@/, '') || 'ทีมงาน'} initial={perms} isNew={false} onClose={() => setPick(false)} onSave={async (p) => { setPerms(p); return true; }} />}
      {edit && <PermDialog username={edit.username} initial={edit.perms} isNew={false} onClose={() => setEdit(null)} onSave={(p) => run({ action: 'perms', id: edit.id, perms: p }, 'บันทึกสิทธิ์แล้ว')} />}
    </div>
  );
}
