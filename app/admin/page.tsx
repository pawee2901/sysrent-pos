import Link from 'next/link';
import { db } from '@/lib/db';
import { baht } from '@/lib/shop';
import { adminShop, bkkMidnight, thMonth, when } from '@/lib/admin-page';
import { ORDER_STATUS } from '@/lib/status';
import { loadProducts } from '@/lib/catalog';

const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/** ภาพรวม: ตัวเลขวันนี้ · ยอดขาย 7 วัน · ต้องทำวันนี้ · โควตาสลิป · ออเดอร์ล่าสุด */
export default async function Dashboard() {
  const shop = await adminShop();
  if (!shop) return null;
  const d = db();
  const today = bkkMidnight(), week = bkkMidnight(6);
  const [{ data: paid }, { count: newCust }, { data: queued }, { count: reset }, { data: renew }, { data: usage }, { data: latest }, products] = await Promise.all([
    d.from('shop_orders').select('total, paid_at').eq('shop_id', shop.id).gte('paid_at', week),
    d.from('shop_customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).gte('created_at', today),
    d.from('shop_order_items').select('id, name, shop_orders!inner(shop_id, code)').eq('status', 'queued').eq('shop_orders.shop_id', shop.id).limit(20),
    d.from('shop_slots').select('id, shop_accounts!inner(shop_id)', { count: 'exact', head: true }).eq('status', 'reset').eq('shop_accounts.shop_id', shop.id),
    d.from('shop_accounts').select('login, cost, renew_at').eq('shop_id', shop.id).eq('status', 'active').not('renew_at', 'is', null).lte('renew_at', new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)).limit(5),
    d.from('shop_slip_usage').select('used, charged').eq('shop_id', shop.id).eq('month', thMonth()).maybeSingle(),
    d.from('shop_orders').select('code, status, total, created_at, shop_customers(username), shop_order_items(name)').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(6),
    loadProducts(shop.id),
  ]);
  const rows = paid ?? [];
  const todaySales = rows.filter((r) => r.paid_at >= today).reduce((s, r) => s + Number(r.total), 0);
  const todayOrders = rows.filter((r) => r.paid_at >= today).length;
  const days = Array.from({ length: 7 }, (_, i) => {
    const from = bkkMidnight(6 - i), to = i === 6 ? '9999' : bkkMidnight(5 - i);
    const v = rows.filter((r) => r.paid_at >= from && r.paid_at < to).reduce((s, r) => s + Number(r.total), 0);
    return [i === 6 ? 'วันนี้' : DAYS[new Date(new Date(from).getTime() + 7 * 3_600_000).getUTCDay()], v] as const;
  });
  const max = Math.max(1, ...days.map((x) => x[1]));
  const freeSlots = products.filter((p) => p.fulfillment === 'slot').reduce((s, p) => s + (p.left ?? 0), 0);
  const out = products.filter((p) => !p.inStock);
  const used = usage?.used ?? 0, pct = Math.min(100, Math.round((used / shop.slip_quota) * 100));
  const todo = [
    ...(queued?.length ? [{ ic: '🛠️', cls: 'warn', t: `ออเดอร์สั่งทำรอส่ง ${queued.length} รายการ`, s: [...new Set(queued.map((q) => q.name.split(' · ')[0]))].slice(0, 3).join(', '), href: '/admin/orders?s=queued', btn: 'ทำเลย' }] : []),
    ...(reset ? [{ ic: '🔑', cls: 'acc', t: `จอรอเปลี่ยน PIN ${reset} จอ`, s: 'ลูกค้าเดิมหมดอายุ เปลี่ยน PIN แล้วกดพร้อมขาย', href: '/admin/accounts', btn: 'ดู' }] : []),
    ...out.slice(0, 3).map((p) => ({ ic: '📦', cls: 'bad', t: `${p.name} หมดสต็อก`, s: 'ลูกค้ากดซื้อไม่ได้', href: p.fulfillment === 'slot' ? '/admin/accounts' : '/admin/products', btn: 'เพิ่ม' })),
    ...(renew ?? []).map((a) => ({ ic: '💳', cls: 'warn', t: `จ่ายค่าบัญชี ${a.login}`, s: `ครบ ${a.renew_at}${a.cost ? ` · ${baht(Number(a.cost))}` : ''}`, href: '/admin/accounts', btn: 'ดู' })),
  ];
  type L = { code: string; status: string; total: number; created_at: string; shop_customers: { username: string } | null; shop_order_items: { name: string }[] };

  return (
    <>
      <div className="page-head"><div><h1>ภาพรวมร้าน</h1><p>อัปเดตทุกครั้งที่เปิดหน้า</p></div>
        <div className="acts"><Link href="/admin/products" className="btn">+ เพิ่มสินค้า</Link><a href="/" target="_blank" rel="noopener noreferrer" className="btn primary">เปิดหน้าร้าน ↗</a></div></div>
      <div className="kpis">
        <div className="card kpi"><span className="lbl">ยอดขายวันนี้<span className="kpi-ic">฿</span></span><span className="val num">{baht(todaySales)}</span><span className="delta mute">{todayOrders} ออเดอร์</span></div>
        <div className="card kpi"><span className="lbl">ยอดขาย 7 วัน<span className="kpi-ic">📈</span></span><span className="val num">{baht(rows.reduce((s, r) => s + Number(r.total), 0))}</span><span className="delta mute">{rows.length} ออเดอร์</span></div>
        <div className="card kpi"><span className="lbl">ลูกค้าใหม่วันนี้<span className="kpi-ic">👤</span></span><span className="val num">{newCust ?? 0}</span><span className="delta mute">สมัครสมาชิกในร้าน</span></div>
        <div className="card kpi"><span className="lbl">จอว่างพร้อมขาย<span className="kpi-ic">🔑</span></span><span className="val num">{freeSlots}</span><span className="delta mute">จากคลังบัญชี</span></div>
      </div>
      <div className="cols">
        <div className="stack">
          <section className="card"><div className="card-head"><h2>ยอดขาย 7 วัน</h2></div>
            <div className="chart">{days.map(([l, v], i) => <div key={i} className="col"><div className="b" style={{ height: `${Math.max(2, (v / max) * 100)}%` }}><span className="tip num">{baht(v)}</span></div><span className="d">{l}</span></div>)}</div>
          </section>
          <section className="card"><div className="card-head"><h2>ออเดอร์ล่าสุด</h2><Link href="/admin/orders" className="btn ghost sm">ดูทั้งหมด →</Link></div>
            {!latest?.length ? <p className="muted card-pad" style={{ margin: 0 }}>ยังไม่มีออเดอร์</p> : (
              <table className="tbl"><thead><tr><th>ออเดอร์</th><th>สินค้า</th><th className="r">ยอด</th><th>สถานะ</th></tr></thead>
                <tbody>{(latest as unknown as L[]).map((o) => { const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending; return (
                  <tr key={o.code}><td><Link href={`/admin/orders?q=${o.code}`} className="code">#{o.code}</Link><small>{when(o.created_at)}</small></td>
                    <td className="m-full">{o.shop_order_items.map((i) => i.name).join(', ')}<small>@{o.shop_customers?.username ?? '-'}</small></td>
                    <td className="r num"><b>{baht(Number(o.total))}</b></td><td><span className={`pill ${st.tone}`}>{st.label}</span></td></tr>); })}</tbody></table>
            )}
          </section>
        </div>
        <div className="stack">
          <section className="card"><div className="card-head"><h2>ต้องทำวันนี้</h2><span className={`pill ${todo.length ? 'warn' : 'ok'}`}>{todo.length ? `${todo.length} รายการ` : 'เรียบร้อย'}</span></div>
            {!todo.length ? <p className="muted card-pad" style={{ margin: 0 }}>ไม่มีงานค้าง 🎉</p> : (
              <ul className="todo">{todo.map((t, i) => <li key={i}><span className={`ic ${t.cls}`}>{t.ic}</span><div className="grow"><b>{t.t}</b><small>{t.s}</small></div><Link href={t.href} className="btn sm">{t.btn}</Link></li>)}</ul>
            )}
          </section>
          <section className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ fontSize: 16 }}>ตรวจสลิปเดือนนี้</h2><span className={`pill ${pct >= 80 ? 'warn' : 'ok'}`}>{pct}%</span></div>
            <div className="num" style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 700, marginTop: 6 }}>{used} <span className="muted" style={{ fontSize: 16, fontWeight: 500 }}>/ {shop.slip_quota} ครั้ง</span></div>
            <div className={`meter${pct >= 80 ? ' warn' : ''}`} style={{ margin: '8px 0' }}><i style={{ width: `${pct}%` }} /></div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>เกินโควตาคิด ฿{shop.slip_overage.toFixed(2)}/สลิป ตัดจากกระเป๋าเงินของคุณใน SysRent{usage?.charged ? ` · เดือนนี้ตัดไปแล้ว ${baht(Number(usage.charged))}` : ''} · ถ้ากระเป๋าไม่พอ ลูกค้าจะจ่ายพร้อมเพย์ไม่ได้ชั่วคราว</p>
          </section>
        </div>
      </div>
    </>
  );
}
