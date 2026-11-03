import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { buildXlsx, type Cell } from '@/lib/xlsx';

const th = (iso: string | null) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 16) : '');

/** ดาวน์โหลด Excel: ?type=orders (ออเดอร์ 2,000 รายการล่าสุด) · ?type=customers */
export async function GET(req: Request) {
  const a = await requireAdmin();
  if ('res' in a) return a.res;
  const type = new URL(req.url).searchParams.get('type') === 'customers' ? 'customers' : 'orders';
  const d = db();
  let rows: Cell[][];
  if (type === 'orders') {
    const { data } = await d.from('shop_orders').select('code, status, total, paid_by, created_at, paid_at, shop_customers(username), shop_order_items(name, qty)')
      .eq('shop_id', a.shop.id).order('created_at', { ascending: false }).limit(2000);
    type R = { code: string; status: string; total: number; paid_by: string | null; created_at: string; paid_at: string | null; shop_customers: { username: string } | null; shop_order_items: { name: string; qty: number }[] };
    rows = [['เลขออเดอร์', 'วันที่สั่ง', 'วันที่จ่าย', 'ลูกค้า', 'สินค้า', 'ยอด', 'ชำระด้วย', 'สถานะ'],
      ...((data ?? []) as unknown as R[]).map((o) => [o.code, th(o.created_at), th(o.paid_at), o.shop_customers?.username ?? '', o.shop_order_items.map((i) => `${i.name} ×${i.qty}`).join(', '), Number(o.total), o.paid_by ?? '', o.status])];
  } else {
    const { data } = await d.from('shop_customers').select('username, contact, balance, blocked, created_at').eq('shop_id', a.shop.id).order('created_at').limit(20000);
    rows = [['ชื่อผู้ใช้', 'ติดต่อ', 'ยอดกระเป๋า', 'สถานะ', 'สมัครเมื่อ'], ...(data ?? []).map((c) => [c.username, c.contact, Number(c.balance), c.blocked ? 'ระงับ' : 'ปกติ', th(c.created_at)])];
  }
  const file = buildXlsx([{ name: type === 'orders' ? 'ออเดอร์' : 'ลูกค้า', rows, widths: type === 'orders' ? [12, 17, 17, 16, 40, 10, 12, 12] : [18, 22, 12, 10, 17] }]);
  return new Response(new Uint8Array(file), {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${a.shop.slug}-${type}.xlsx"`, 'Cache-Control': 'no-store' },
  });
}
