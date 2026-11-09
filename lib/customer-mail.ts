import { to as publicPath } from '@/lib/routes';
import 'server-only';
import { db } from '@/lib/db';
import { mailConfigured, sendMail, shopSmtp } from '@/lib/mail';
import { itemMail } from '@/lib/mail-template';
import { accentHex } from '@/lib/colors';
import type { Shop } from '@/lib/shop';

const thb = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

export type MailResult = 'sent' | 'no_email' | 'no_sender' | 'failed';
export const MAIL_RESULT: Record<MailResult, string> = {
  sent: 'ส่งอีเมลแจ้งลูกค้าแล้ว',
  no_email: 'ลูกค้ายังไม่ได้ใส่อีเมลในบัญชี',
  no_sender: 'ร้านยังไม่ได้เชื่อม Gmail ตั้งได้ที่ ตั้งค่าร้าน → แจ้งลูกค้าทางอีเมล',
  failed: 'ส่งอีเมลไม่สำเร็จ ลองกด "ส่งอีเมลทดสอบ" ที่ ตั้งค่าร้าน → แจ้งลูกค้าทางอีเมล',
};

/** ส่งอีเมลแจ้งผลรายการให้ลูกค้า แล้วบอกผลลัพธ์ (ส่งไม่ได้ไม่กระทบการส่งของ / คืนเงินที่สำเร็จไปแล้ว) */
export async function sendItemMail(shop: Pick<Shop, 'id' | 'name' | 'slug' | 'accent'>, itemId: string, kind: 'deliver' | 'refund', reason: string): Promise<MailResult> {
  const { data, error } = await db().from('shop_order_items')
    .select('name, total, customer_info, shop_orders!inner(code, total, subtotal, shop_customers!inner(email))').eq('id', itemId).maybeSingle();
  if (error || !data) { if (error) console.error('[mail] โหลดออเดอร์ไม่ได้', error.message); return 'failed'; } // ยังไม่รัน 0020
  const o = data.shop_orders as unknown as { code: string; total: number; subtotal: number | null; shop_customers: { email: string } };
  // อีเมลตอนสมัครไม่บังคับ → ใช้อีเมลที่ลูกค้ากรอกตอนสั่งสินค้าแทน (เช่น อีเมลสำหรับเชิญเข้าครอบครัว)
  const to = o.shop_customers.email || (String(data.customer_info ?? '').match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0] ?? '');
  if (!to) return 'no_email';
  const smtp = await shopSmtp(shop.id);
  if (!smtp && !mailConfigured()) return 'no_sender';
  const root = process.env.SHOP_ROOT_DOMAIN || 'sysrent.shop';
  const base = { shopName: shop.name, code: o.code, product: data.name as string, url: `https://${shop.slug}.${root}${publicPath('/orders')}`, color: accentHex(shop.accent) };
  const amount = o.subtotal ? Math.round((Number(data.total) * Number(o.total) / Number(o.subtotal)) * 100) / 100 : Number(data.total);
  const ok = await sendMail({ to, fromName: shop.name, smtp, ...itemMail(kind === 'deliver' ? { ...base, kind } : { ...base, kind, amount: thb(amount), reason }) });
  return ok ? 'sent' : 'failed';
}
