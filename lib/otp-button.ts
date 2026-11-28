import 'server-only';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';

/** ปุ่มรับ OTP ของรายการที่ซื้อ: แอปที่ค้น + อีเมลที่แอดมินใส่ไว้ที่สต็อกชิ้นนั้น (การค้นจริงยังเช็กสิทธิ์ซ้ำที่ /api/otp) */
export type OtpButton = { appId: string; appName: string; emails: string[]; link?: string };

/**
 * สินค้าที่ร้านเปิดปุ่มรับ OTP → แอปที่ค้น (productId → { appId, appName })
 * ร้านที่ไม่มีฟีเจอร์ค้นหา OTP / ยังไม่รัน 0032 = ไม่มีปุ่ม (คืน Map ว่าง ไม่ทำให้หน้าพัง)
 */
export async function otpApps(shop: { id: string; plan: string }, productIds: string[]): Promise<Map<string, { appId: string; appName: string }>> {
  const out = new Map<string, { appId: string; appName: string }>();
  if (!productIds.length || !can(shop.plan, 'otp')) return out;
  const { data, error } = await db().from('shop_products').select('id, otp_app_id, shop_otp_apps(name)')
    .eq('shop_id', shop.id).in('id', productIds).not('otp_app_id', 'is', null);
  if (error) return out;
  for (const r of (data ?? []) as unknown as { id: string; otp_app_id: string; shop_otp_apps: { name: string } | null }[]) {
    if (r.shop_otp_apps) out.set(r.id, { appId: r.otp_app_id, appName: r.shop_otp_apps.name });
  }
  return out;
}

/** อีเมลรับ OTP ที่แอดมินใส่ไว้ที่สต็อก ต่อรายการที่ซื้อ (orderItemId → อีเมล) · ยังไม่รัน 0032 = ว่าง */
export async function otpEmails(orderItemIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!orderItemIds.length) return out;
  const { data, error } = await db().from('shop_stock').select('order_item_id, otp_email')
    .in('order_item_id', orderItemIds).eq('status', 'sold').not('otp_email', 'is', null);
  if (error) return out;
  for (const r of (data ?? []) as { order_item_id: string; otp_email: string }[]) {
    const list = out.get(r.order_item_id) ?? [];
    if (!list.includes(r.otp_email)) list.push(r.otp_email);
    out.set(r.order_item_id, list);
  }
  return out;
}
