import { to } from '@/lib/routes';
import 'server-only';
import { db } from '@/lib/db';
import { bkkMidnight } from '@/lib/admin-page';
import { adminUrl, postDiscord } from '@/lib/notify';

const baht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const sum = (rows: { v: unknown }[]) => rows.reduce((s, r) => s + Number(r.v), 0);

/** ส่งสรุปยอดของเมื่อวาน (เวลาไทย) เข้า Discord ของร้าน · ยอดขายนับแบบเดียวกับหน้าภาพรวม */
export async function sendDailySummary(shop: { id: string; name: string; slug: string; discord_webhook: string }) {
  const d = db(), from = bkkMidnight(1), until = bkkMidnight();
  const [orders, topups, customers, items] = await Promise.all([
    d.from('shop_orders').select('total').eq('shop_id', shop.id).gte('paid_at', from).lt('paid_at', until).limit(10000),
    // QR ที่จ่ายออเดอร์ตรง (pay_order) นับในยอดขายแล้ว ไม่ใช่การเติมเงิน
    d.from('shop_topups').select('amount').eq('shop_id', shop.id).eq('status', 'paid').is('pay_order', null).gte('paid_at', from).lt('paid_at', until).limit(10000),
    d.from('shop_customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).gte('created_at', from).lt('created_at', until),
    d.from('shop_order_items').select('name, qty, shop_orders!inner(shop_id, paid_at)').eq('shop_orders.shop_id', shop.id).gte('shop_orders.paid_at', from).lt('shop_orders.paid_at', until).limit(10000),
  ]);
  const failed = orders.error ?? topups.error ?? customers.error ?? items.error;
  if (failed) throw new Error(failed.message);

  const orderRows = orders.data ?? [], topupRows = topups.data ?? [];
  const sold = new Map<string, number>();
  for (const i of items.data ?? []) sold.set(i.name, (sold.get(i.name) ?? 0) + Number(i.qty));
  const best = [...sold].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, q]) => `• ${n} — ${q} ชิ้น`).join('\n').slice(0, 1000);
  const day = new Date(from).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });

  const r = await postDiscord(shop.discord_webhook, shop.name, [{
    title: `📊 สรุปยอดวันที่ ${day}`, color: 0x8b5cf6, url: adminUrl(shop, to('/admin')),
    fields: [
      { name: 'ยอดขาย', value: baht(sum(orderRows.map((o) => ({ v: o.total })))), inline: true },
      { name: 'ออเดอร์', value: `${orderRows.length.toLocaleString('th-TH')} รายการ`, inline: true },
      { name: 'เติมเงิน', value: `${baht(sum(topupRows.map((t) => ({ v: t.amount }))))} (${topupRows.length.toLocaleString('th-TH')} ครั้ง)`, inline: true },
      { name: 'สมาชิกใหม่', value: `${(customers.count ?? 0).toLocaleString('th-TH')} คน`, inline: true },
      ...(best ? [{ name: 'ขายดี', value: best }] : []),
    ],
  }]);
  if (!r.ok) throw new Error(r.error);
}
