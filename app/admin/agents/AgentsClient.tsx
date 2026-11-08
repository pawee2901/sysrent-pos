'use client';
import { to } from '@/lib/routes';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';

export type AgentRow = { id: string; code: string; name: string; active: boolean; since: string; user: string; contact: string; balance: number; orders: number; spent: number };

/** ตัวแทน (ซื้อราคาส่ง): เพิ่มจากชื่อผู้ใช้ลูกค้า · พักสิทธิ์ · เอาออก · ดูยอดซื้อ */
export function AgentsClient({ rows, enabled, ready }: { rows: AgentRow[]; enabled: boolean; ready: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(body: object, ok: string) {
    setBusy(true);
    const r = await api('/api/admin/agents', body);
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return false; }
    notify(ok); router.refresh(); return true;
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await run({ action: 'add', username: user, name }, `ตั้ง @${user.replace(/^@/, '')} เป็นตัวแทนแล้ว`)) { setUser(''); setName(''); }
  }
  async function remove(r: AgentRow) {
    if (await ask(`เอา @${r.user} ออกจากตัวแทน?`, { text: 'ต่อจากนี้จะซื้อในราคาปกติ และกลับไปอยู่ในหน้าลูกค้า (ประวัติยอดซื้อเดิมยังอยู่ในออเดอร์)', ok: 'เอาออก', danger: true })) run({ action: 'remove', id: r.id }, 'เอาออกแล้ว');
  }
  const active = rows.filter((r) => r.active).length;

  return (
    <>
      <div className="page-head"><div><h1>ตัวแทน</h1><p>{rows.length ? `${active} คนใช้งานอยู่ · ยอดซื้อรวม ${baht(rows.reduce((s, r) => s + r.spent, 0))}` : 'ตัวแทนซื้อสินค้าในราคาส่ง แล้วไปขายต่อเอง'}</p></div></div>
      {!enabled && <div className="card card-pad" style={{ marginBottom: 16 }}><b>🔒 ระบบตัวแทนเป็นฟีเจอร์ของแพ็กเกจ Pro (฿399/เดือน)</b><p className="muted" style={{ margin: '6px 0 0' }}>อัปเกรดแพ็กเกจที่ sysrent.shop เพื่อตั้งราคาส่งให้ตัวแทน</p></div>}
      {!ready && <div className="card card-pad" style={{ marginBottom: 16 }}><b>⚠️ ต้องรัน SQL 0016_agents.sql ก่อน</b></div>}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>เพิ่มตัวแทน</h2></div>
        <form className="form" onSubmit={add}>
          <div className="two">
            <label className="field"><span>ชื่อผู้ใช้ของลูกค้า (ต้องสมัครสมาชิกร้านก่อน)</span><input className="input" value={user} maxLength={40} placeholder="เช่น pawee2080" onChange={(e) => setUser(e.target.value)} disabled={!enabled || !ready} /></label>
            <label className="field"><span>ชื่อเรียก / ชื่อร้านของตัวแทน (ไม่บังคับ)</span><input className="input" value={name} maxLength={60} placeholder="เช่น ร้านน้องมุก" onChange={(e) => setName(e.target.value)} disabled={!enabled || !ready} /></label>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="btn primary" disabled={busy || !enabled || !ready || !user.trim()}>+ ตั้งเป็นตัวแทน</button>
            <small className="faint">หรือเปลี่ยนยศในหน้า <Link href={to('/admin/customers')} style={{ color: 'var(--accent)', fontWeight: 600 }}>ลูกค้า</Link> · ตั้งราคาส่งที่ <Link href={to('/admin/products')} style={{ color: 'var(--accent)', fontWeight: 600 }}>สินค้า</Link> → แพ็กเกจ → ช่อง &quot;🤝 ราคาตัวแทน&quot;</small>
          </div>
        </form>
      </section>

      {rows.length > 0 && (
        <section className="card">
          <table className="tbl atbl">
            <thead><tr><th>ตัวแทน</th><th>ติดต่อ</th><th className="r">ซื้อแล้ว</th><th className="r">กระเป๋า</th><th>สถานะ</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} style={{ cursor: 'default', opacity: r.active ? 1 : .55 }}>
                <td className="a-user"><b>@{r.user}</b>{r.name && <span className="muted"> · {r.name}</span>}<small>ตั้งเมื่อ {r.since} · โค้ด {r.code}</small></td>
                <td className="a-contact">{r.contact || <span className="faint">ไม่ได้ใส่ช่องทางติดต่อ</span>}</td>
                <td className="r num a-spent"><b>{baht(r.spent)}</b><small>{r.orders} ออเดอร์</small></td>
                <td className="r num a-bal">{baht(r.balance)}</td>
                <td className="a-st"><button type="button" className={`toggle${r.active ? ' on' : ''}`} aria-label="เปิด/พักสิทธิ์ตัวแทน" disabled={busy} onClick={() => run({ action: 'toggle', id: r.id, active: !r.active }, r.active ? 'พักสิทธิ์แล้ว' : 'เปิดสิทธิ์แล้ว')} /></td>
                <td className="a-act"><button type="button" className="btn ghost sm danger" disabled={busy} onClick={() => remove(r)}>เอาออก</button></td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </>
  );
}
