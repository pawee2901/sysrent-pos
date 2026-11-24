/* =============================================================
   แจ้งเตือนลูกค้าผ่านแอปร้าน (Web Push) · ตาราง shop_push_subs (SQL 0038)
   ทุกฟังก์ชันพังได้เงียบ ๆ (ยังไม่รัน SQL / ลูกค้าไม่ได้เปิดรับ = ไม่ส่ง)
   ============================================================= */
import 'server-only';
import { db } from '@/lib/db';
import { to as publicPath } from '@/lib/routes';
import { sendPush, type PushMessage } from '@/lib/webpush';

/** บริการส่งแจ้งเตือนของเบราว์เซอร์ที่ยอมรับ (กันส่งคำขอไปเว็บอื่น) */
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)web\.push\.apple\.com$/];
export function pushEndpointOk(endpoint: string): boolean {
  try { const u = new URL(endpoint); return u.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(u.hostname)); } catch { return false; }
}

type Row = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(rows: Row[], msg: PushMessage): Promise<number> {
  let ok = 0;
  const gone: string[] = [];
  for (let i = 0; i < rows.length; i += 20) {
    const res = await Promise.all(rows.slice(i, i + 20).map((r) => sendPush(r, msg)));
    res.forEach((x, k) => { if (x === 'ok') ok++; else if (x === 'gone') gone.push(rows[i + k].id); });
  }
  if (gone.length) await db().from('shop_push_subs').delete().in('id', gone);
  return ok;
}

/** แจ้งลูกค้า 1 คน (ทุกเครื่องที่เปิดรับ) */
export async function pushCustomer(shopId: string, customerId: string, msg: PushMessage): Promise<number> {
  const { data, error } = await db().from('shop_push_subs').select('id, endpoint, p256dh, auth').eq('shop_id', shopId).eq('customer_id', customerId).limit(20);
  if (error || !data?.length) return 0;
  return deliver(data as Row[], msg);
}

/** แจ้งลูกค้าทุกคนของร้านที่เปิดรับ (ร้านส่งโปรโมชัน) */
export async function pushShop(shopId: string, msg: PushMessage): Promise<number> {
  const { data, error } = await db().from('shop_push_subs').select('id, endpoint, p256dh, auth').eq('shop_id', shopId).limit(5000);
  if (error || !data?.length) return 0;
  return deliver(data as Row[], msg);
}

/** แจ้งเจ้าของรายการสินค้า (ร้านส่งของสั่งทำ / คืนเงิน) */
export async function pushItem(shop: { id: string; name: string }, itemId: string, kind: 'deliver' | 'refund'): Promise<void> {
  const { data } = await db().from('shop_order_items').select('name, shop_orders!inner(code, customer_id, shop_id)').eq('id', itemId).maybeSingle();
  const o = data?.shop_orders as unknown as { code: string; customer_id: string; shop_id: string } | undefined;
  if (!data || !o || o.shop_id !== shop.id) return;
  const product = String(data.name).split(' · ')[0];
  await pushCustomer(shop.id, o.customer_id, kind === 'deliver'
    ? { title: `✅ ${shop.name}: ได้ของแล้ว`, body: `${product} พร้อมใช้งาน กดดูรหัสได้เลย (ออเดอร์ #${o.code})`, url: publicPath('/orders'), tag: `item-${itemId}` }
    : { title: `↩️ ${shop.name}: คืนเงินแล้ว`, body: `${product} · ออเดอร์ #${o.code} · เงินเข้ากระเป๋าในร้านแล้ว`, url: publicPath('/orders'), tag: `item-${itemId}` });
}

/** แจ้งลูกค้าว่าร้านตอบเรื่องที่แจ้งปัญหา */
export async function pushReport(shop: { id: string; name: string }, reportId: string): Promise<void> {
  const { data } = await db().from('shop_reports').select('customer_id, reply, topic, status').eq('id', reportId).eq('shop_id', shop.id).maybeSingle();
  if (!data?.customer_id) return;
  await pushCustomer(shop.id, data.customer_id, {
    title: `💬 ${shop.name} ตอบเรื่องที่คุณแจ้งแล้ว`, body: `${data.status === 'resolved' ? '(แก้ไขแล้ว) ' : ''}${String(data.reply ?? '').slice(0, 120)}`, url: publicPath('/orders'), tag: `report-${reportId}`,
  });
}
