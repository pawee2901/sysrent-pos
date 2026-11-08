import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { body, fail, requireCustomer } from '@/lib/api';
import { otpAccounts } from '@/lib/otp-access';
import { OtpMailboxError, searchOtp } from '@/lib/otp-search';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const schema = z.object({ account: z.string().trim().toLowerCase().email().max(120), appId: z.string().uuid() });
const PER_MINUTE = 6;

/** ลูกค้าค้น OTP: ต้องล็อกอิน และค้นได้เฉพาะอีเมลในสินค้าของตัวเองที่ยังไม่หมดอายุ */
export async function POST(req: Request) {
  const c = await requireCustomer();
  if ('res' in c) return c.res;
  if (!can(c.shop.plan, 'otp')) return fail('ร้านนี้ยังไม่เปิดใช้งานค้นหา OTP', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const { account, appId } = b.data, d = db(), shopId = c.shop.id;

  const allowed = await otpAccounts(shopId, c.me.id);
  if (!allowed.some((a) => a.email === account)) return fail('ค้นได้เฉพาะอีเมลในสินค้าที่ยังไม่หมดอายุของคุณ', 403);

  const { data: app } = await d.from('shop_otp_apps').select('name, keywords, code').eq('id', appId).eq('shop_id', shopId).maybeSingle();
  if (!app) return fail('ไม่พบแอปนี้', 404);

  const { count, error } = await d.from('shop_otp_requests').select('id', { count: 'exact', head: true }).eq('customer_id', c.me.id).gte('created_at', new Date(Date.now() - 60_000).toISOString());
  if (error) return fail('ร้านยังไม่พร้อมใช้งานค้นหา OTP', 503);
  if ((count ?? 0) >= PER_MINUTE) return fail('ค้นหาบ่อยเกินไป กรุณารอสักครู่', 429);

  const log = (found: boolean) => d.from('shop_otp_requests').insert({ shop_id: shopId, customer_id: c.me.id, account, app: app.name, found });
  try {
    const hits = await searchOtp({ shopId, account, appName: app.name, keywords: app.keywords, appCode: app.code ?? '' });
    await log(hits.length > 0);
    return NextResponse.json({ ok: true, hits });
  } catch (e) {
    await log(false);
    if (e instanceof OtpMailboxError) return fail('ตอนนี้ร้านอ่านกล่องอีเมลไม่ได้ กรุณาแจ้งร้าน', 502);
    console.error('[otp]', (e as Error).message);
    return fail('ค้นหาไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
