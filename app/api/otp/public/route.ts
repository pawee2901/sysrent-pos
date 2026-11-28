import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { body, fail } from '@/lib/api';
import { getShop } from '@/lib/shop';
import { clientIp } from '@/lib/auth';
import { otpAccounts } from '@/lib/otp-access';
import { otpLink, otpPublic } from '@/lib/otp-link';
import { OtpMailboxError, searchOtp } from '@/lib/otp-search';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const schema = z.object({ account: z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง').max(120), appId: z.string().uuid() });
const PER_MINUTE = 6;
const PER_HOUR = 40;

/**
 * หน้ารับ OTP (ไม่ต้องล็อกอิน): ร้านต้องเปิดสวิตช์ไว้
 * ค้นได้เฉพาะอีเมลในสินค้าที่ร้านขายไปแล้วและยังไม่หมดอายุ · จำกัดต่อ IP
 */
export async function POST(req: Request) {
  const shop = await getShop();
  if (!shop || !can(shop.plan, 'otp')) return fail('ร้านนี้ยังไม่เปิดใช้งานค้นหา OTP', 403);
  if (!(await otpPublic(shop.id)) || (await otpLink(shop.id))) return fail('ร้านปิดหน้ารับ OTP อยู่', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const { account, appId } = b.data, d = db(), shopId = shop.id, ip = await clientIp();

  const recent = (ms: number) => d.from('shop_otp_requests').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('ip', ip).gte('created_at', new Date(Date.now() - ms).toISOString());
  const [m, h] = await Promise.all([recent(60_000), recent(3_600_000)]);
  if (m.error) return fail('ร้านยังไม่พร้อมใช้งานหน้ารับ OTP', 503);
  if ((m.count ?? 0) >= PER_MINUTE || (h.count ?? 0) >= PER_HOUR) return fail('ค้นหาบ่อยเกินไป กรุณารอสักครู่', 429);

  const { data: app } = await d.from('shop_otp_apps').select('name, keywords, code').eq('id', appId).eq('shop_id', shopId).maybeSingle();
  if (!app) return fail('ไม่พบแอปนี้', 404);
  const log = (found: boolean) => d.from('shop_otp_requests').insert({ shop_id: shopId, customer_id: null, ip, account, app: app.name, found });

  const allowed = await otpAccounts(shopId);
  if (!allowed.some((a) => a.email === account)) { await log(false); return fail('ไม่พบอีเมลนี้ในสินค้าของร้านที่ยังไม่หมดอายุ', 403); }

  try {
    const hits = await searchOtp({ shopId, account, appName: app.name, keywords: app.keywords, appCode: app.code ?? '' });
    await log(hits.length > 0);
    return NextResponse.json({ ok: true, hits });
  } catch (e) {
    await log(false);
    if (e instanceof OtpMailboxError) return fail('ตอนนี้ร้านอ่านกล่องอีเมลไม่ได้ กรุณาแจ้งร้าน', 502);
    console.error('[otp public]', (e as Error).message);
    return fail('ค้นหาไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
