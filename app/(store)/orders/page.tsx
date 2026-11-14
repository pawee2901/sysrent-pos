import { loginUrl } from '@/lib/routes';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getShop } from '@/lib/shop';
import { customerEmail, getCustomer } from '@/lib/auth';
import { EmailPrompt } from './EmailPrompt';
import { can } from '@/lib/plan';
import { db } from '@/lib/db';
import { canReport } from '@/lib/reports';
import { productMedia } from '@/lib/media';
import { HistoryCard, type HOrder } from './HistoryCard';

export const dynamic = 'force-dynamic';

type Item = { id: string; name: string; total: number; status: string; delivered: string | null; product_id: string; option_id: string; fulfillment: string; updated_at: string };
type Row = { id: string; code: string; status: string; total: number; created_at: string; paid_at: string | null; expires_at: string; shop_order_items: Item[] };
const thDate = (d: Date) => d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });

/** ประวัติการซื้อ: การ์ดต่อออเดอร์ (คัดลอกข้อมูล · วันหมดประกัน · แสดงไอดี · แจ้งปัญหา) */
export default async function Orders() {
  const me = await getCustomer();
  if (!me) redirect(loginUrl('/orders'));
  const shop = (await getShop())!;
  const d = db();
  const { data } = await d.from('shop_orders').select('id, code, status, total, created_at, paid_at, expires_at, shop_order_items(id, name, total, status, delivered, product_id, option_id, fulfillment, updated_at)')
    .eq('shop_id', shop.id).eq('customer_id', me.id).order('created_at', { ascending: false }).limit(50);
  const rows = ((data ?? []) as unknown as Row[]).map((o) => ({ ...o, status: o.status === 'pending' && new Date(o.expires_at).getTime() < Date.now() ? 'cancelled' : o.status }));
  const items = rows.flatMap((o) => o.shop_order_items);
  const productIds = [...new Set(items.map((i) => i.product_id))];

  // ข้อมูลประกอบ (แต่ละอย่างพังได้โดยไม่ทำให้หน้าล่ม — เช่น ยังไม่รัน SQL ของฟีเจอร์นั้น)
  const [opts, subs, usage, reports] = await Promise.all([
    d.from('shop_options').select('id, duration_days').in('id', [...new Set(items.map((i) => i.option_id))]),
    d.from('shop_subscriptions').select('id, status, starts_at, ends_at, order_item_id, shop_products(id, image, template)').eq('shop_id', shop.id).eq('customer_id', me.id).in('order_item_id', items.map((i) => i.id)),
    productMedia({ ids: productIds }),
    d.from('shop_reports').select('order_id, topic, status, reply, image, created_at').eq('customer_id', me.id).in('order_id', rows.map((o) => o.id)).order('created_at', { ascending: false })
      .then((r) => (r.error ? d.from('shop_reports').select('order_id, topic, status, reply, created_at').eq('customer_id', me.id).in('order_id', rows.map((o) => o.id)).order('created_at', { ascending: false }) : r)),
  ]);
  type Sub = { id: string; status: string; starts_at: string; ends_at: string; order_item_id: string; shop_products: { id: string; image: string; template: string } | null };
  const subOf = (id: string) => ((subs.data ?? []) as unknown as Sub[]).find((s) => s.order_item_id === id);
  const prod = (id: string) => usage.map.get(id);

  const orders: HOrder[] = rows.map((o) => {
    const paidAt = o.paid_at ? new Date(o.paid_at) : null;
    const ends = o.shop_order_items.map((i) => {
      const sub = subOf(i.id);
      if (sub) return new Date(sub.ends_at);
      const days = opts.data?.find((x) => x.id === i.option_id)?.duration_days;
      // สั่งทำ: ประกันเริ่มตอนร้านส่งของ (ยังไม่ส่ง = ยังไม่เริ่มนับ) · แบบอื่นเริ่มตอนจ่าย
      const start = i.fulfillment === 'manual' ? (i.status === 'delivered' ? new Date(i.updated_at) : null) : paidAt;
      return start && days ? new Date(start.getTime() + days * 86_400_000) : null;
    });
    const last = ends.filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
    const rep = (reports.data ?? []).find((r) => r.order_id === o.id);
    return {
      code: o.code, status: o.status, total: Number(o.total),
      boughtAt: thDate(paidAt ?? new Date(o.created_at)), warranty: last ? thDate(last) : null, expired: !!last && last.getTime() < Date.now(),
      report: rep ? { topic: rep.topic, status: rep.status, reply: rep.reply ?? '', image: (rep as { image?: string }).image ?? '' } : null,
      items: o.shop_order_items.map((i, k) => {
        const sub = subOf(i.id);
        const p = prod(i.product_id);
        return {
          id: i.id, name: i.name, total: Number(i.total), queued: i.status === 'queued', delivered: i.status === 'delivered' ? i.delivered : null,
          warranty: ends[k] ? `${thDate(ends[k]!)}` : null, usage: p?.usage ?? '', usageImages: p?.usageImages ?? [],
          sub: sub ? { id: sub.id, active: sub.status === 'active', startsAt: sub.starts_at, endsAt: sub.ends_at, productId: sub.shop_products?.id ?? '', image: sub.shop_products?.image ?? '', template: sub.shop_products?.template ?? '' } : null,
        };
      }),
    };
  });

  return (
    <div className="hist-wrap">
      <div className="sec-head hist-head"><h1 style={{ fontSize: 26 }}>ประวัติการซื้อ</h1><span className="muted" style={{ fontSize: 14 }}>{orders.length} ออเดอร์ · กด &quot;แสดงไอดี&quot; เพื่อดูรหัส</span></div>
      {can(shop.plan, 'mail') && orders.some((o) => o.items.some((i) => i.queued)) && !(await customerEmail(me.id)) && <EmailPrompt />}
      {!orders.length ? <div className="card success"><p className="muted">ยังไม่มีออเดอร์</p><Link href="/" className="btn primary">ไปเลือกสินค้า</Link></div>
        : <div className="hcards">{orders.map((o) => <HistoryCard key={o.code} o={o} canReport={canReport(shop.plan)} />)}</div>}
    </div>
  );
}
