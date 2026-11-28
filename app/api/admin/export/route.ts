import { can } from '@/lib/plan';
import { db } from '@/lib/db';
import { fail, requireAdmin } from '@/lib/api';
import { buildXlsx, type Cell } from '@/lib/xlsx';
import { loadLedger } from '@/lib/ledger';

const th = (iso: string | null) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 16) : '');

/** ดาวน์โหลด Excel: ?type=orders (ออเดอร์ 2,000 รายการล่าสุด) · ?type=customers */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  if (sp.get('type') === 'ledger') return ledgerXlsx(sp.get('p') ?? 'month');
  const type = sp.get('type') === 'customers' ? 'customers' : 'orders';
  const a = await requireAdmin(type); // ส่งออกออเดอร์ = สิทธิ์ออเดอร์ · ส่งออกลูกค้า = สิทธิ์ลูกค้า
  if ('res' in a) return a.res;
  if (!can(a.shop.plan, 'export')) return fail('ส่งออก Excel อยู่ในแพ็กเกจ Max', 403);
  const d = db();
  let rows: Cell[][];
  if (type === 'orders') {
    const { data } = await d.from('shop_orders').select('code, status, total, discount, paid_by, created_at, paid_at, shop_coupons(code), shop_customers(username), shop_order_items(name, qty, customer_info)')
      .eq('shop_id', a.shop.id).order('created_at', { ascending: false }).limit(2000);
    type R = { code: string; status: string; total: number; discount: number; paid_by: string | null; created_at: string; paid_at: string | null; shop_coupons: { code: string } | null;
      shop_customers: { username: string } | null; shop_order_items: { name: string; qty: number; customer_info: string | null }[] };
    rows = [['เลขออเดอร์', 'วันที่สั่ง', 'วันที่จ่าย', 'ลูกค้า', 'สินค้า', 'ข้อมูลที่ลูกค้ากรอก', 'ส่วนลด', 'โค้ด', 'ยอด', 'ชำระด้วย', 'สถานะ'],
      ...((data ?? []) as unknown as R[]).map((o) => [o.code, th(o.created_at), th(o.paid_at), o.shop_customers?.username ?? '', o.shop_order_items.map((i) => `${i.name} ×${i.qty}`).join(', '),
        o.shop_order_items.map((i) => i.customer_info).filter(Boolean).join(', '), Number(o.discount ?? 0), o.shop_coupons?.code ?? '', Number(o.total), o.paid_by ?? '', o.status])];
  } else {
    const { data } = await d.from('shop_customers').select('username, contact, balance, blocked, created_at').eq('shop_id', a.shop.id).order('created_at').limit(20000);
    rows = [['ชื่อผู้ใช้', 'ติดต่อ', 'ยอดกระเป๋า', 'สถานะ', 'สมัครเมื่อ'], ...(data ?? []).map((c) => [c.username, c.contact, Number(c.balance), c.blocked ? 'ระงับ' : 'ปกติ', th(c.created_at)])];
  }
  const file = buildXlsx([{ name: type === 'orders' ? 'ออเดอร์' : 'ลูกค้า', rows, widths: type === 'orders' ? [12, 17, 17, 16, 40, 28, 10, 12, 10, 12, 12] : [18, 22, 12, 10, 17] }]);
  return new Response(new Uint8Array(file), {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${a.shop.slug}-${type}.xlsx"`, 'Cache-Control': 'no-store' },
  });
}

/** สมุดบัญชี → Excel 4 ชีต: งบกำไรขาดทุน · สมุดบัญชี · กำไรตามสินค้า · บัญชีเงิน */
async function ledgerXlsx(p: string) {
  const a = await requireAdmin('accounting');
  if ('res' in a) return a.res;
  if (!can(a.shop.plan, 'accounting')) return fail('ระบบบัญชีอยู่ในแพ็กเกจของร้าน', 403);
  const l = await loadLedger(a.shop.id, p, 100_000);
  const t = l.totals, acc = (id: string | null) => l.accounts.find((x) => x.id === id)?.name ?? '';
  const gross = t.sales - t.cost, net = gross + t.otherIn - t.out;
  const summary: Cell[][] = [
    ['รายการ', 'จำนวนเงิน (บาท)'],
    [`${a.shop.name} · ${l.period.label} (${l.period.from} ถึง ${l.period.to})`, null],
    ['รายได้จากการขาย', t.sales], ['หัก ต้นทุนขาย', -t.cost], ['กำไรขั้นต้น', gross], ['รายได้อื่น', t.otherIn],
    ...l.outByCat.map((c): Cell[] => [`หัก ${c.category}`, -c.amount]),
    ['กำไร (ขาดทุน) สุทธิ', net], ['คืนเงินลูกค้า (ไม่นับเป็นรายได้)', t.refunded], ['จำนวนออเดอร์', t.orders],
  ];
  const book: Cell[][] = [['วันที่', 'เวลา', 'ประเภท', 'หมวด', 'รายละเอียด', 'บัญชี', 'เลขที่อ้างอิง', 'รายรับ', 'รายจ่าย', 'ต้นทุนสินค้า'],
    ...[...l.entries].reverse().map((e): Cell[] => [e.date, e.time, e.src === 'sale' ? 'ยอดขาย' : e.kind === 'in' ? 'รายรับ' : e.kind === 'out' ? 'รายจ่าย' : 'โอน',
      e.category, e.note, e.kind === 'transfer' ? `${acc(e.account)} → ${acc(e.toAccount)}` : acc(e.account), e.ref,
      e.kind === 'in' ? e.amount : null, e.kind === 'out' ? e.amount : null, e.src === 'sale' ? e.cost ?? 0 : null])];
  const prods: Cell[][] = [['สินค้า', 'จำนวนที่ขาย', 'รายรับ', 'ต้นทุน', 'กำไร'], ...l.products.map((x): Cell[] => [x.name, x.qty, x.revenue, x.cost, x.profit])];
  const accs: Cell[][] = [['บัญชี', 'ประเภท', 'เลขบัญชี', 'ยอดตั้งต้น', 'ยอดคงเหลือ', 'รับเงินขาย'],
    ...l.accounts.map((x): Cell[] => [x.name, { bank: 'ธนาคาร', cash: 'เงินสด', wallet: 'วอลเล็ต', other: 'อื่น ๆ' }[x.kind], x.number, x.opening, x.balance, x.isSales ? 'ใช่' : ''])];
  const file = buildXlsx([
    { name: 'งบกำไรขาดทุน', rows: summary, widths: [46, 18] },
    { name: 'สมุดบัญชี', rows: book, widths: [12, 8, 10, 18, 44, 20, 16, 12, 12, 12] },
    { name: 'กำไรตามสินค้า', rows: prods, widths: [30, 12, 12, 12, 12] },
    { name: 'บัญชีเงิน', rows: accs, widths: [24, 12, 18, 14, 14, 12] },
  ]);
  return new Response(new Uint8Array(file), {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${a.shop.slug}-ledger-${l.period.from}.xlsx"`, 'Cache-Control': 'no-store' },
  });
}
