import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { PlanLock } from '@/components/PlanLock';
import { adminShop, when } from '@/lib/admin-page';
import { AccountingClient, type Ledger } from './AccountingClient';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000, TZ = 7 * 3_600_000;
/** วันที่ (เวลาไทย) → เที่ยงคืนไทยเป็น UTC */
const bkk = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - TZ);
const ymd = (d: Date) => new Date(d.getTime() + TZ).toISOString().slice(0, 10);

/** ช่วงเวลา (เวลาไทย): today · 7d · month (ค่าเริ่มต้น) · lastmonth · year */
function range(p: string): { from: Date; to: Date; label: string; key: string } {
  const now = new Date(Date.now() + TZ);
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  const tomorrow = bkk(y, m, d + 1);
  if (p === 'today') return { from: bkk(y, m, d), to: tomorrow, label: 'วันนี้', key: p };
  if (p === '7d') return { from: bkk(y, m, d - 6), to: tomorrow, label: '7 วันล่าสุด', key: p };
  if (p === 'lastmonth') return { from: bkk(y, m - 1, 1), to: bkk(y, m, 1), label: 'เดือนที่แล้ว', key: p };
  if (p === 'year') return { from: bkk(y, 0, 1), to: tomorrow, label: `ปี ${y + 543}`, key: p };
  return { from: bkk(y, m, 1), to: tomorrow, label: 'เดือนนี้', key: 'month' };
}

type Item = { name: string; qty: number; total: number; status: string; unit_cost?: number | null };
type Order = { code: string; total: number; subtotal: number | null; paid_at: string; paid_by: string | null; shop_customers: { username: string } | null; shop_order_items: Item[] };

/** บัญชี: รายรับ (ออเดอร์ที่จ่ายแล้ว หักส่วนลด / คืนเงิน) · ต้นทุนตอนขาย · กำไร · รายจ่ายอื่น */
export default async function Accounting({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const shop = await adminShop('accounting');
  if (!shop) return null;
  if (!can(shop.plan, 'accounting')) return <PlanLock feature="accounting" />;
  const { p = 'month' } = await searchParams;
  const r = range(p);
  const d = db();

  const cols = 'code, total, subtotal, paid_at, paid_by, shop_customers(username), shop_order_items(name, qty, total, status, unit_cost)';
  let q = await d.from('shop_orders').select(cols).eq('shop_id', shop.id).gte('paid_at', r.from.toISOString()).lt('paid_at', r.to.toISOString()).order('paid_at', { ascending: false }).limit(5000);
  const costReady = !q.error;
  if (q.error) q = await d.from('shop_orders').select(cols.replace(', unit_cost', '')).eq('shop_id', shop.id).gte('paid_at', r.from.toISOString()).lt('paid_at', r.to.toISOString()).order('paid_at', { ascending: false }).limit(5000) as typeof q; // ยังไม่รัน 0019
  const orders = (q.data ?? []) as unknown as Order[];

  const ex = await d.from('shop_expenses').select('id, spent_on, category, note, amount').eq('shop_id', shop.id).gte('spent_on', ymd(r.from)).lt('spent_on', ymd(r.to)).order('spent_on', { ascending: false }).limit(1000);

  // ต่อออเดอร์: ส่วนลดเฉลี่ยตามสัดส่วน (เหมือนตอนคืนเงิน) · รายการที่คืนเงินแล้ว = ไม่นับรายรับ / ต้นทุน
  const byProduct = new Map<string, { qty: number; revenue: number; cost: number }>();
  let missingCost = 0;
  const rows = orders.map((o) => {
    const ratio = o.subtotal && Number(o.subtotal) > 0 ? Number(o.total) / Number(o.subtotal) : 1;
    let revenue = 0, cost = 0, refunded = 0;
    for (const i of o.shop_order_items) {
      const rev = Math.round(Number(i.total) * ratio * 100) / 100;
      if (i.status === 'refunded') { refunded += rev; continue; }
      const c = i.unit_cost === null || i.unit_cost === undefined ? null : Number(i.unit_cost) * i.qty;
      if (c === null) missingCost++;
      revenue += rev; cost += c ?? 0;
      const key = i.name.split(' · ')[0];
      const pr = byProduct.get(key) ?? { qty: 0, revenue: 0, cost: 0 };
      pr.qty += i.qty; pr.revenue += rev; pr.cost += c ?? 0;
      byProduct.set(key, pr);
    }
    return { code: o.code, when: when(o.paid_at), user: o.shop_customers?.username ?? '', paidBy: o.paid_by ?? '', items: o.shop_order_items.map((i) => i.name).join(', '), revenue, cost, profit: revenue - cost, refunded };
  });
  const sum = (k: 'revenue' | 'cost' | 'refunded') => rows.reduce((s, x) => s + x[k], 0);
  const expenses = (ex.data ?? []).map((e) => ({ id: e.id as string, date: e.spent_on as string, category: e.category as string, note: e.note as string, amount: Number(e.amount) }));
  const exTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const ledger: Ledger = {
    period: { key: r.key, label: r.label, from: ymd(r.from), to: ymd(new Date(r.to.getTime() - DAY)) },
    totals: { revenue: sum('revenue'), cost: sum('cost'), refunded: sum('refunded'), expenses: exTotal, orders: rows.length },
    orders: rows.slice(0, 200), more: Math.max(0, rows.length - 200),
    products: [...byProduct.entries()].map(([name, v]) => ({ name, ...v, profit: v.revenue - v.cost })).sort((a, b) => b.profit - a.profit).slice(0, 20),
    expenses, missingCost, costReady, expensesReady: !ex.error, today: ymd(new Date()),
  };
  return <AccountingClient l={ledger} />;
}
