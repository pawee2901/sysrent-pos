import { to as publicPath } from '@/lib/routes';
import 'server-only';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { sendMail, shopSmtp } from '@/lib/mail';
import { itemMail } from '@/lib/mail-template';
import { accentHex } from '@/lib/colors';
import { can } from '@/lib/plan';
import type { Shop } from '@/lib/shop';

const thb = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

/** ร้านส่งของ / คืนเงินแล้ว → อีเมลแจ้งลูกค้า (ทำหลังตอบหน้าเว็บ · ลูกค้าไม่มีอีเมล หรือส่งไม่สำเร็จ = งานหลักยังสำเร็จ) */
export function mailItemResult(shop: Pick<Shop, 'id' | 'name' | 'slug' | 'accent' | 'plan'>, itemId: string, kind: 'deliver' | 'refund', reason: string) {
  if (!can(shop.plan, 'mail')) return;
  after(async () => {
    const { data, error } = await db().from('shop_order_items')
      .select('name, total, shop_orders!inner(code, total, subtotal, shop_customers!inner(email))').eq('id', itemId).maybeSingle();
    if (error || !data) { if (error) console.error('[mail] โหลดออเดอร์ไม่ได้', error.message); return; } // ยังไม่รัน 0020
    const o = data.shop_orders as unknown as { code: string; total: number; subtotal: number | null; shop_customers: { email: string } };
    const to = o.shop_customers.email;
    if (!to) return;
    const root = process.env.SHOP_ROOT_DOMAIN || 'sysrent.shop';
    const base = { shopName: shop.name, code: o.code, product: data.name as string, url: `https://${shop.slug}.${root}${publicPath('/orders')}`, color: accentHex(shop.accent) };
    const amount = o.subtotal ? Math.round((Number(data.total) * Number(o.total) / Number(o.subtotal)) * 100) / 100 : Number(data.total);
    await sendMail({ to, fromName: shop.name, smtp: await shopSmtp(shop.id), ...itemMail(kind === 'deliver' ? { ...base, kind } : { ...base, kind, amount: thb(amount), reason }) });
  });
}
