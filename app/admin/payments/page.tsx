import { db } from '@/lib/db';
import { baht } from '@/lib/shop';
import { adminShop, bkkMidnight, thMonth, when } from '@/lib/admin-page';

const ST: Record<string, [string, string]> = { paid: ['สำเร็จ', 'ok'], pending: ['รอสลิป', ''], expired: ['หมดเวลา', 'bad'], cancelled: ['ยกเลิก', ''] };

/** การชำระเงิน: รับเงินวันนี้ · โควตาตรวจสลิป · รายการโอนล่าสุด (สลิปที่ไม่ผ่านบอกสาเหตุ) */
export default async function AdminPayments() {
  const shop = await adminShop('payments');
  if (!shop) return null;
  const d = db();
  const [{ data: rows }, { data: usage }, { data: today }] = await Promise.all([
    d.from('shop_topups').select('id, amount, status, attempts, last_error, slip, pay_order, created_at, shop_customers(username)').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(80),
    d.from('shop_slip_usage').select('used, charged').eq('shop_id', shop.id).eq('month', thMonth()).maybeSingle(),
    d.from('shop_topups').select('amount').eq('shop_id', shop.id).eq('status', 'paid').gte('paid_at', bkkMidnight()),
  ]);
  const used = usage?.used ?? 0;
  type R = { id: string; amount: number; status: string; attempts: number; last_error: string | null; slip: { sender?: string; bank?: string } | null; pay_order: string | null; created_at: string; shop_customers: { username: string } | null };
  return (
    <>
      <div className="page-head"><div><h1>การชำระเงิน</h1><p>เงินเข้าบัญชีพร้อมเพย์ของร้านโดยตรง · ระบบตรวจสลิปอัตโนมัติ</p></div></div>
      <div className="kpis">
        <div className="card kpi"><span className="lbl">รับเงินวันนี้</span><span className="val num">{baht((today ?? []).reduce((s, r) => s + Number(r.amount), 0))}</span><span className="delta mute">{today?.length ?? 0} รายการ</span></div>
        <div className="card kpi"><span className="lbl">ตรวจสลิปเดือนนี้</span><span className="val num">{used} / {shop.slip_quota}</span><span className={`delta${used >= shop.slip_quota ? ' down' : ' mute'}`}>{used >= shop.slip_quota ? 'เกินโควตาแล้ว' : `เหลือฟรี ${shop.slip_quota - used} ครั้ง`}</span></div>
        <div className="card kpi"><span className="lbl">ค่าสลิปเกินโควตา</span><span className="val num">{baht(Number(usage?.charged ?? 0))}</span><span className="delta mute">฿{shop.slip_overage.toFixed(2)}/สลิป · ตัดจากกระเป๋า SysRent</span></div>
        <div className="card kpi"><span className="lbl">พร้อมเพย์ของร้าน</span><span className="val" style={{ fontSize: 18 }}>{shop.promptpay_id ? `•••${shop.promptpay_id.replace(/\D/g, '').slice(-4)}` : 'ยังไม่ตั้ง'}</span><span className={`delta${shop.promptpay_id ? ' mute' : ' down'}`}>{shop.promptpay_id ? shop.receiver_name || 'ตั้งชื่อบัญชีด้วย' : 'ตั้งในหน้าตั้งค่าร้าน'}</span></div>
      </div>
      <section className="card"><div className="card-head"><h2>รายการโอนล่าสุด</h2><span className="muted">สลิปที่ไม่ผ่านจะบอกสาเหตุ</span></div>
        {!rows?.length ? <p className="muted card-pad" style={{ margin: 0 }}>ยังไม่มีรายการ</p> : (
          <table className="tbl"><thead><tr><th>ลูกค้า</th><th className="r">ยอด</th><th>ผลตรวจ</th><th>รายละเอียด</th><th>เวลา</th></tr></thead>
            <tbody>{((rows ?? []) as unknown as R[]).map((r) => { const [l, t] = ST[r.status] ?? [r.status, '']; return (
              <tr key={r.id} style={{ cursor: 'default' }}><td><b>@{r.shop_customers?.username ?? '-'}</b><small>{r.pay_order ? 'จ่ายออเดอร์' : 'เติมกระเป๋า'}</small></td>
                <td className="r num"><b>{baht(Number(r.amount))}</b></td><td><span className={`pill ${t}`}>{l}</span></td>
                <td className="m-full muted">{r.status === 'paid' ? `ผู้โอน ${r.slip?.sender ?? '-'}${r.slip?.bank ? ` · ${r.slip.bank}` : ''}` : r.last_error ? `${r.last_error} (อัป ${r.attempts} ครั้ง)` : 'ยังไม่อัปสลิป'}</td>
                <td className="muted m-hide">{when(r.created_at)}</td></tr>); })}</tbody></table>
        )}
      </section>
    </>
  );
}
