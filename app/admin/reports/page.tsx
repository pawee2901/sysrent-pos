import { db } from '@/lib/db';
import { adminShop, when } from '@/lib/admin-page';
import { canReport } from '@/lib/reports';
import { decrypt } from '@/lib/secret';
import { ReportsClient, type AdminReport, type ReportItem } from './ReportsClient';

export const dynamic = 'force-dynamic';

/** เรื่องที่ลูกค้าแจ้งปัญหา (เปิดอยู่ก่อน) + สินค้า / ไอดีของออเดอร์นั้น ให้ร้านแก้ได้ในหน้าเดียว */
export default async function AdminReports() {
  const shop = await adminShop('reports');
  if (!shop) return null;
  const d = db();
  const { data, error } = await d.from('shop_reports').select('*, shop_orders(id, code, shop_order_items(id, name, fulfillment, status, delivered)), shop_customers(username, contact)')
    .eq('shop_id', shop.id).order('status').order('created_at', { ascending: false }).limit(100);
  type It = { id: string; name: string; fulfillment: string; status: string; delivered: string | null };
  type R = { id: string; topic: string; message: string; status: string; reply: string; image?: string; created_at: string;
    shop_orders: { id: string; code: string; shop_order_items: It[] } | null; shop_customers: { username: string; contact: string } | null };
  const list = (data ?? []) as unknown as R[];

  // แบบแบ่งจอ: บัญชีหลัก + โปรไฟล์ที่ลูกค้าได้ (ถอดรหัสฝั่งเซิร์ฟเวอร์ · ร้านเห็นคนเดียว)
  const itemIds = list.flatMap((r) => r.shop_orders?.shop_order_items.filter((i) => i.fulfillment === 'slot').map((i) => i.id) ?? []);
  const { data: subs } = itemIds.length
    ? await d.from('shop_subscriptions').select('order_item_id, status, ends_at, shop_slots(id, label, pin, shop_accounts(id, login, secret_enc))').in('order_item_id', itemIds)
    : { data: [] };
  type Sub = { order_item_id: string; status: string; ends_at: string; shop_slots: { id: string; label: string; pin: string; shop_accounts: { id: string; login: string; secret_enc: string } } | null };
  const slotOf = (itemId: string) => {
    const s = ((subs ?? []) as unknown as Sub[]).find((x) => x.order_item_id === itemId);
    if (!s?.shop_slots) return null;
    let password = '';
    try { password = decrypt(s.shop_slots.shop_accounts.secret_enc); } catch { password = '(ถอดรหัสไม่ได้)'; }
    return { slotId: s.shop_slots.id, login: s.shop_slots.shop_accounts.login, password, profile: s.shop_slots.label, pin: s.shop_slots.pin, active: s.status === 'active' && new Date(s.ends_at).getTime() > Date.now() };
  };

  const rows: AdminReport[] = list.map((r) => ({
    id: r.id, topic: r.topic, message: r.message, image: r.image ?? '', status: r.status, reply: r.reply, when: when(r.created_at),
    code: r.shop_orders?.code ?? '', user: r.shop_customers?.username ?? '', contact: r.shop_customers?.contact ?? '',
    items: (r.shop_orders?.shop_order_items ?? []).map((i): ReportItem => ({
      id: i.id, name: i.name, fulfillment: i.fulfillment, status: i.status, delivered: i.delivered ?? '', slot: i.fulfillment === 'slot' ? slotOf(i.id) : null,
    })),
  }));
  return <ReportsClient rows={rows} enabled={canReport(shop.plan)} ready={!error} />;
}
