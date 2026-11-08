import 'server-only';
import { db } from '@/lib/db';

export type OtpAccount = { email: string; product: string; until: string };

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const DAY = 86_400_000;
const DEFAULT_DAYS = 30; // ตัวเลือกที่ไม่ได้กำหนดจำนวนวัน

type Item = { name: string; status: string; fulfillment: string; delivered: string | null; customer_info: string | null; updated_at: string; shop_options: { duration_days: number | null } | null };
type Order = { paid_at: string | null; shop_order_items: Item[] };
type Sub = { ends_at: string; shop_products: { name: string } | null; shop_slots: { shop_accounts: { login: string } | null } | null };

/** อีเมลที่ลูกค้าคนนี้ค้น OTP ได้: จากสินค้าของตัวเองที่ยังไม่หมดอายุเท่านั้น */
export async function otpAccounts(shopId: string, customerId: string): Promise<OtpAccount[]> {
  const d = db(), now = Date.now(), found = new Map<string, OtpAccount>();
  const add = (email: string, product: string, until: number) => {
    const key = email.toLowerCase(), cur = found.get(key);
    if (!cur || new Date(cur.until).getTime() < until) found.set(key, { email: key, product, until: new Date(until).toISOString() });
  };

  const [subs, orders] = await Promise.all([
    d.from('shop_subscriptions').select('ends_at, shop_products(name), shop_slots(shop_accounts(login))')
      .eq('shop_id', shopId).eq('customer_id', customerId).eq('status', 'active').gt('ends_at', new Date(now).toISOString()).limit(200),
    d.from('shop_orders').select('paid_at, shop_order_items(name, status, fulfillment, delivered, customer_info, updated_at, shop_options(duration_days))')
      .eq('shop_id', shopId).eq('customer_id', customerId).not('paid_at', 'is', null).order('paid_at', { ascending: false }).limit(300),
  ]);

  for (const s of (subs.data ?? []) as unknown as Sub[]) {
    const login = s.shop_slots?.shop_accounts?.login ?? '';
    for (const email of login.match(EMAIL) ?? []) add(email, s.shop_products?.name ?? '', new Date(s.ends_at).getTime());
  }
  for (const o of (orders.data ?? []) as unknown as Order[]) {
    for (const i of o.shop_order_items) {
      if (i.status !== 'delivered') continue;
      const start = new Date(i.fulfillment === 'manual' ? i.updated_at : (o.paid_at as string)).getTime();
      const until = start + (i.shop_options?.duration_days ?? DEFAULT_DAYS) * DAY;
      if (until <= now) continue;
      for (const email of `${i.delivered ?? ''} ${i.customer_info ?? ''}`.match(EMAIL) ?? []) add(email, i.name.split(' · ')[0], until);
    }
  }
  return [...found.values()].sort((a, b) => a.email.localeCompare(b.email));
}
