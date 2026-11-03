'use client';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';

type C = { id: string; username: string; contact: string; balance: number; blocked: boolean; joined: string; orders: number; spent: number };

/** ลูกค้า: ค้นหา · ปรับยอดกระเป๋า (ต้องใส่เหตุผล) · ระงับ · ตั้งรหัสผ่านใหม่ */
export function CustomersClient({ rows, total, q }: { rows: C[]; total: number; q: string }) {
  const router = useRouter();
  async function run(body: object, ok: string) {
    const r = await api('/api/admin/customers', body);
    if (!r.ok) { alert(r.error); return; }
    alert(ok); router.refresh();
  }
  function adjust(c: C) {
    const v = prompt(`ปรับยอดกระเป๋า @${c.username} (คงเหลือ ${baht(c.balance)})\nใส่จำนวน เช่น 100 หรือ -50`, '');
    if (!v) return;
    const amount = Number(v);
    if (!Number.isFinite(amount) || !amount) { alert('จำนวนไม่ถูกต้อง'); return; }
    const note = prompt('เหตุผล (บันทึกในประวัติลูกค้า)', amount > 0 ? 'ร้านเติมเงินให้' : 'ร้านหักยอด');
    if (!note) return;
    run({ action: 'adjust', id: c.id, amount, note }, 'ปรับยอดแล้ว');
  }
  function resetPw(c: C) {
    const p = prompt(`ตั้งรหัสผ่านใหม่ให้ @${c.username} (อย่างน้อย 6 ตัว)\nแล้วแจ้งลูกค้าทาง LINE`, '');
    if (p) run({ action: 'password', id: c.id, password: p }, 'ตั้งรหัสผ่านใหม่แล้ว');
  }
  return (
    <>
      <div className="page-head"><div><h1>ลูกค้า</h1><p>{total.toLocaleString('th-TH')} คน · ปรับยอดเงิน · ระงับ · ตั้งรหัสผ่านใหม่</p></div>
        <div className="acts"><a href="/api/admin/export?type=customers" className="btn">⬇ ส่งออก Excel</a></div></div>
      <section className="card">
        <form className="toolbar" action="/admin/customers"><input className="input" name="q" defaultValue={q} placeholder="🔍 ชื่อผู้ใช้ / LINE / เบอร์" /></form>
        {!rows.length ? <p className="muted card-pad" style={{ margin: 0 }}>ไม่พบลูกค้า</p> : (
          <table className="tbl">
            <thead><tr><th>ลูกค้า</th><th>ติดต่อ</th><th className="r">กระเป๋า</th><th className="r">ซื้อแล้ว</th><th>จัดการ</th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id} style={{ cursor: 'default', opacity: c.blocked ? .55 : 1 }}>
                <td className="m-full"><b>@{c.username}</b> {c.blocked && <span className="pill bad">ระงับ</span>}<small>สมัคร {c.joined}</small></td>
                <td>{c.contact || <span className="faint">-</span>}</td>
                <td className="r num"><b>{baht(c.balance)}</b></td>
                <td className="r num">{c.orders} ครั้ง<small>{baht(c.spent)}</small></td>
                <td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn sm" onClick={() => adjust(c)}>ปรับยอด</button>
                  <button type="button" className="btn ghost sm" onClick={() => resetPw(c)}>รหัสผ่าน</button>
                  <button type="button" className={`btn ghost sm${c.blocked ? '' : ' danger'}`} onClick={() => run({ action: 'block', id: c.id, blocked: !c.blocked }, c.blocked ? 'ยกเลิกระงับแล้ว' : 'ระงับแล้ว')}>{c.blocked ? 'ยกเลิกระงับ' : 'ระงับ'}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </>
  );
}
