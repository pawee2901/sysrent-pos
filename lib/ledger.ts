import 'server-only';
import { db } from '@/lib/db';

/**
 * สมุดบัญชีร้าน: ยอดขาย (จากออเดอร์ อัตโนมัติ) + รายการที่จดเอง (รายรับ / รายจ่าย / โอน) + บัญชีเงินหลายบัญชี
 * ใช้ทั้งหน้า "บัญชี" และไฟล์ Excel · ยังไม่รัน 0058 = อ่านรายจ่ายเดิม (shop_expenses) แทน
 */
const DAY = 86_400_000, TZ = 7 * 3_600_000;
const bkk = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - TZ);
export const ymd = (d: Date) => new Date(d.getTime() + TZ).toISOString().slice(0, 10);

export type Period = { from: Date; to: Date; label: string; key: string };
/** ช่วงเวลา (เวลาไทย): today · 7d · month (ค่าเริ่มต้น) · lastmonth · year · YYYY-MM (เดือนที่เลือก) */
export function period(p: string): Period {
  const now = new Date(Date.now() + TZ);
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  const tomorrow = bkk(y, m, d + 1);
  if (p === 'today') return { from: bkk(y, m, d), to: tomorrow, label: 'วันนี้', key: p };
  if (p === '7d') return { from: bkk(y, m, d - 6), to: tomorrow, label: '7 วันล่าสุด', key: p };
  if (p === 'lastmonth') return { from: bkk(y, m - 1, 1), to: bkk(y, m, 1), label: 'เดือนที่แล้ว', key: p };
  if (p === 'year') return { from: bkk(y, 0, 1), to: tomorrow, label: `ปี ${y + 543}`, key: p };
  const mm = /^(\d{4})-(\d{2})$/.exec(p);
  if (mm) {
    const yy = Number(mm[1]), mo = Number(mm[2]) - 1;
    if (mo >= 0 && mo < 12 && yy > 2000 && yy < 2100) {
      const label = new Date(Date.UTC(yy, mo, 15)).toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      return { from: bkk(yy, mo, 1), to: bkk(yy, mo + 1, 1), label, key: p };
    }
  }
  return { from: bkk(y, m, 1), to: tomorrow, label: 'เดือนนี้', key: 'month' };
}

export type MoneyAccount = { id: string; name: string; kind: 'bank' | 'cash' | 'wallet' | 'other'; number: string; opening: number; isSales: boolean; active: boolean; balance: number; createdAt: string };
export type Entry = {
  id: string; src: 'manual' | 'sale'; kind: 'in' | 'out' | 'transfer'; date: string; time: string; category: string; note: string; amount: number;
  account: string | null; toAccount: string | null; ref: string; cost?: number; refunded?: number;
};
export type LedgerData = {
  period: { key: string; label: string; from: string; to: string };
  totals: { sales: number; cost: number; refunded: number; otherIn: number; out: number; orders: number };
  entries: Entry[]; more: number;
  products: { name: string; qty: number; revenue: number; cost: number; profit: number }[];
  outByCat: { category: string; amount: number }[];
  accounts: MoneyAccount[];
  missingCost: number; costReady: boolean; ledgerReady: boolean; today: string;
};

type Item = { name: string; qty: number; total: number; status: string; unit_cost?: number | null };
type Order = { code: string; total: number; subtotal: number | null; paid_at: string; shop_customers: { username: string } | null; shop_order_items: Item[] };

/** ออเดอร์ 1 ใบ → รายรับสุทธิ (เฉลี่ยส่วนลดตามสัดส่วน · ไม่นับรายการที่คืนเงิน) + ต้นทุน */
function orderMoney(o: Order) {
  const ratio = o.subtotal && Number(o.subtotal) > 0 ? Number(o.total) / Number(o.subtotal) : 1;
  let revenue = 0, cost = 0, refunded = 0, missing = 0;
  const lines: { key: string; qty: number; rev: number; cost: number }[] = [];
  for (const i of o.shop_order_items ?? []) {
    const rev = Math.round(Number(i.total) * ratio * 100) / 100;
    if (i.status === 'refunded') { refunded += rev; continue; }
    const c = i.unit_cost === null || i.unit_cost === undefined ? null : Number(i.unit_cost) * i.qty;
    if (c === null) missing++;
    revenue += rev; cost += c ?? 0;
    lines.push({ key: i.name.split(' · ')[0], qty: i.qty, rev, cost: c ?? 0 });
  }
  return { revenue, cost, refunded, missing, lines };
}
const thTime = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

export async function loadLedger(shopId: string, p: string, limit = 400): Promise<LedgerData> {
  const r = period(p);
  const d = db();
  const cols = 'code, total, subtotal, paid_at, shop_customers(username), shop_order_items(name, qty, total, status, unit_cost)';
  const oq = (c: string) => d.from('shop_orders').select(c).eq('shop_id', shopId).not('paid_at', 'is', null).gte('paid_at', r.from.toISOString()).lt('paid_at', r.to.toISOString()).order('paid_at', { ascending: false }).limit(5000);
  let q = await oq(cols);
  const costReady = !q.error;
  if (q.error) q = await oq(cols.replace(', unit_cost', ''));
  const orders = (q.data ?? []) as unknown as Order[];

  // รายการที่จดเอง
  const lq = await d.from('shop_ledger').select('id, kind, on_date, category, note, amount, account_id, to_account, ref, created_at').eq('shop_id', shopId)
    .gte('on_date', ymd(r.from)).lt('on_date', ymd(r.to)).order('on_date', { ascending: false }).order('created_at', { ascending: false }).limit(3000);
  const ledgerReady = !lq.error;
  type L = { id: string; kind: Entry['kind']; on_date: string; category: string; note: string; amount: number; account_id: string | null; to_account: string | null; ref: string; created_at: string };
  let manual: L[] = (lq.data ?? []) as L[];
  if (!ledgerReady) {
    const ex = await d.from('shop_expenses').select('id, spent_on, category, note, amount, created_at').eq('shop_id', shopId).gte('spent_on', ymd(r.from)).lt('spent_on', ymd(r.to)).order('spent_on', { ascending: false }).limit(1000);
    manual = ((ex.data ?? []) as { id: string; spent_on: string; category: string; note: string; amount: number; created_at: string }[])
      .map((e) => ({ id: e.id, kind: 'out', on_date: e.spent_on, category: e.category, note: e.note, amount: e.amount, account_id: null, to_account: null, ref: '', created_at: e.created_at }));
  }

  // บัญชีเงิน + ยอดคงเหลือ (ตลอดเวลา ไม่ขึ้นกับช่วงที่เลือก)
  const aq = ledgerReady ? await d.from('shop_money_accounts').select('id, name, kind, number, opening, is_sales, active, created_at').eq('shop_id', shopId).order('sort').order('created_at') : { data: [] };
  const accRows = (aq.data ?? []) as { id: string; name: string; kind: MoneyAccount['kind']; number: string; opening: number; is_sales: boolean; active: boolean; created_at: string }[];
  const bal = new Map(accRows.map((a) => [a.id, Number(a.opening)]));
  if (accRows.length) {
    const all = await d.from('shop_ledger').select('kind, amount, account_id, to_account').eq('shop_id', shopId).limit(50000);
    for (const e of (all.data ?? []) as { kind: string; amount: number; account_id: string | null; to_account: string | null }[]) {
      const amt = Number(e.amount);
      if (e.account_id && bal.has(e.account_id)) bal.set(e.account_id, bal.get(e.account_id)! + (e.kind === 'in' ? amt : -amt));
      if (e.kind === 'transfer' && e.to_account && bal.has(e.to_account)) bal.set(e.to_account, bal.get(e.to_account)! + amt);
    }
    // ยอดขายเข้าบัญชีรับเงินขาย (นับตั้งแต่วันที่สร้างบัญชี = ยอดตั้งต้นคือยอด ณ วันนั้น)
    for (const a of accRows.filter((x) => x.is_sales)) {
      const sq = await d.from('shop_orders').select('total, subtotal, shop_order_items(total, status)').eq('shop_id', shopId).not('paid_at', 'is', null).gte('paid_at', a.created_at).limit(50000);
      const sales = ((sq.data ?? []) as unknown as Order[]).reduce((s, o) => s + orderMoney({ ...o, shop_order_items: (o.shop_order_items ?? []).map((i) => ({ ...i, name: '', qty: 0 })) }).revenue, 0);
      bal.set(a.id, bal.get(a.id)! + sales);
    }
  }
  const accounts: MoneyAccount[] = accRows.map((a) => ({ id: a.id, name: a.name, kind: a.kind, number: a.number, opening: Number(a.opening), isSales: a.is_sales, active: a.active, balance: Math.round(bal.get(a.id)! * 100) / 100, createdAt: a.created_at }));
  const salesAcc = accounts.find((a) => a.isSales)?.id ?? null;

  // รวม
  const byProduct = new Map<string, { qty: number; revenue: number; cost: number }>();
  let missingCost = 0, sales = 0, cost = 0, refunded = 0;
  const saleEntries: Entry[] = orders.map((o) => {
    const m = orderMoney(o);
    missingCost += m.missing; sales += m.revenue; cost += m.cost; refunded += m.refunded;
    for (const l of m.lines) {
      const pr = byProduct.get(l.key) ?? { qty: 0, revenue: 0, cost: 0 };
      pr.qty += l.qty; pr.revenue += l.rev; pr.cost += l.cost; byProduct.set(l.key, pr);
    }
    return {
      id: `o-${o.code}`, src: 'sale', kind: 'in', date: ymd(new Date(o.paid_at)), time: thTime(o.paid_at), category: 'ยอดขาย',
      note: `${(o.shop_order_items ?? []).map((i) => i.name).join(', ')}${o.shop_customers ? ` · @${o.shop_customers.username}` : ''}`.slice(0, 200),
      amount: m.revenue, account: salesAcc, toAccount: null, ref: o.code, cost: m.cost, refunded: m.refunded,
    } satisfies Entry;
  });
  const manualEntries: Entry[] = manual.map((e) => ({
    id: e.id, src: 'manual', kind: e.kind, date: e.on_date, time: thTime(e.created_at), category: e.category, note: e.note, amount: Number(e.amount),
    account: e.account_id, toAccount: e.to_account, ref: e.ref ?? '',
  }));
  const otherIn = manualEntries.filter((e) => e.kind === 'in').reduce((s, e) => s + e.amount, 0);
  const outs = manualEntries.filter((e) => e.kind === 'out');
  const outCat = new Map<string, number>();
  for (const e of outs) outCat.set(e.category || 'อื่น ๆ', (outCat.get(e.category || 'อื่น ๆ') ?? 0) + e.amount);

  const entries = [...saleEntries, ...manualEntries].sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));
  return {
    period: { key: r.key, label: r.label, from: ymd(r.from), to: ymd(new Date(r.to.getTime() - DAY)) },
    totals: { sales, cost, refunded, otherIn, out: outs.reduce((s, e) => s + e.amount, 0), orders: orders.length },
    entries: entries.slice(0, limit), more: Math.max(0, entries.length - limit),
    products: [...byProduct.entries()].map(([name, v]) => ({ name, ...v, profit: v.revenue - v.cost })).sort((a, b) => b.profit - a.profit).slice(0, 30),
    outByCat: [...outCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    accounts, missingCost, costReady, ledgerReady, today: ymd(new Date()),
  };
}
