import 'server-only';
import { db } from '@/lib/db';
import { otpEmails } from '@/lib/otp-button';

/** items = รายการที่ซื้อ (order item) ที่มีอีเมลนี้ · ใช้นับโควตาขอ OTP ต่อออเดอร์ */
export type OtpAccount = { email: string; product: string; until: string; items: string[] };

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const DAY = 86_400_000;
const DEFAULT_DAYS = 30; // ตัวเลือกที่ไม่ได้กำหนดจำนวนวัน

type Item = { id: string; name: string; status: string; fulfillment: string; delivered: string | null; customer_info: string | null; updated_at: string; shop_options: { duration_days: number | null } | null };
type Order = { paid_at: string | null; shop_order_items: Item[] };
type Sub = { ends_at: string; shop_products: { name: string } | null; shop_slots: { shop_accounts: { login: string } | null } | null };

/** อีเมลที่ลูกค้าคนนี้ค้น OTP ได้: จากสินค้าของตัวเองที่ยังไม่หมดอายุเท่านั้น */
/** customerId ไม่ใส่ = อีเมลของสินค้าที่ยังไม่หมดอายุทั้งร้าน (หน้ารับ OTP แบบไม่ต้องล็อกอิน) */
export async function otpAccounts(shopId: string, customerId?: string): Promise<OtpAccount[]> {
  const d = db(), now = Date.now(), found = new Map<string, OtpAccount>();
  const add = (email: string, product: string, until: number, item?: string) => {
    const key = email.toLowerCase(), cur = found.get(key);
    const items = [...new Set([...(cur?.items ?? []), ...(item ? [item] : [])])];
    if (!cur || new Date(cur.until).getTime() < until) found.set(key, { email: key, product, until: new Date(until).toISOString(), items });
    else cur.items = items;
  };

  let sq = d.from('shop_subscriptions').select('ends_at, shop_products(name), shop_slots(shop_accounts(login))')
    .eq('shop_id', shopId).eq('status', 'active').gt('ends_at', new Date(now).toISOString());
  let oq = d.from('shop_orders').select('paid_at, shop_order_items(id, name, status, fulfillment, delivered, customer_info, updated_at, shop_options(duration_days))')
    .eq('shop_id', shopId).not('paid_at', 'is', null);
  if (customerId) { sq = sq.eq('customer_id', customerId); oq = oq.eq('customer_id', customerId); }
  else oq = oq.gt('paid_at', new Date(now - 400 * DAY).toISOString()); // ทั้งร้าน: ย้อนหลังพอสำหรับแพ็กเกจยาวสุด
  const [subs, orders] = await Promise.all([sq.limit(customerId ? 200 : 3000), oq.order('paid_at', { ascending: false }).limit(customerId ? 300 : 3000)]);

  for (const s of (subs.data ?? []) as unknown as Sub[]) {
    const login = s.shop_slots?.shop_accounts?.login ?? '';
    for (const email of login.match(EMAIL) ?? []) add(email, s.shop_products?.name ?? '', new Date(s.ends_at).getTime());
  }
  const live: { id: string; name: string; until: number }[] = [];
  for (const o of (orders.data ?? []) as unknown as Order[]) {
    for (const i of o.shop_order_items) {
      if (i.status !== 'delivered') continue;
      const start = new Date(i.fulfillment === 'manual' ? i.updated_at : (o.paid_at as string)).getTime();
      const until = start + (i.shop_options?.duration_days ?? DEFAULT_DAYS) * DAY;
      if (until <= now) continue;
      live.push({ id: i.id, name: i.name.split(' · ')[0], until });
      for (const email of `${i.delivered ?? ''} ${i.customer_info ?? ''}`.match(EMAIL) ?? []) add(email, i.name.split(' · ')[0], until, i.id);
    }
  }
  // เมลรับ OTP ที่แอดมินใส่เองตอนเพิ่มสต็อก (ปุ่มรับรหัส OTP) — อาจไม่อยู่ในข้อความที่ลูกค้าได้
  const fromStock = await otpEmails(live.map((i) => i.id));
  for (const i of live) for (const email of fromStock.get(i.id) ?? []) add(email, i.name, i.until, i.id);
  return [...found.values()].sort((a, b) => a.email.localeCompare(b.email));
}
