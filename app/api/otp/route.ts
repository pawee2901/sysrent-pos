import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { body, fail, requireCustomer } from '@/lib/api';
import { otpAccounts } from '@/lib/otp-access';
import { otpCustBlocked } from '@/lib/otp-link';
import { fullMsg, pickItem } from '@/lib/otp-quota';
import { OtpMailboxError, searchOtp } from '@/lib/otp-search';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// itemId = ปุ่มในประวัติการซื้อ (นับโควตาของออเดอร์นั้น) · ack = ลูกค้าติ๊กยอมรับเงื่อนไขจำนวนครั้งแล้ว
const schema = z.object({ account: z.string().trim().toLowerCase().email().max(120), appId: z.string().uuid(), itemId: z.string().uuid().optional(), ack: z.boolean().optional() });
const PER_MINUTE = 6;

/** ลูกค้าค้น OTP: ต้องล็อกอิน และค้นได้เฉพาะอีเมลในสินค้าของตัวเองที่ยังไม่หมดอายุ */
export async function POST(req: Request) {
  const c = await requireCustomer();
  if ('res' in c) return c.res;
  if (!can(c.shop.plan, 'otp')) return fail('ร้านนี้ยังไม่เปิดใช้งานค้นหา OTP', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const { account, appId, itemId, ack } = b.data, d = db(), shopId = c.shop.id;

  const allowed = await otpAccounts(shopId, c.me.id);
  const mine = allowed.find((a) => a.email === account);
  if (!mine) return fail('ค้นได้เฉพาะอีเมลในสินค้าที่ยังไม่หมดอายุของคุณ', 403);
  // โควตาต่อออเดอร์ (ตั้งที่แพ็กเกจ): ครบแล้ว = ขอไม่ได้ · ยังไม่ยอมรับเงื่อนไข = ให้หน้าเว็บขึ้นป๊อปอัปก่อน
  const { pick, full } = await pickItem(mine.items, itemId);
  if (full) return fail(fullMsg(full), 429);
  if (pick?.limit && !ack) return NextResponse.json({ error: 'กรุณายอมรับเงื่อนไขก่อนค้นหา', need_ack: { limit: pick.limit, used: pick.used, name: pick.name } }, { status: 409 });

  const { data: app } = await d.from('shop_otp_apps').select('name, keywords, code').eq('id', appId).eq('shop_id', shopId).maybeSingle();
  if (!app) return fail('ไม่พบแอปนี้', 404);

  const { count, error } = await d.from('shop_otp_requests').select('id', { count: 'exact', head: true }).eq('customer_id', c.me.id).gte('created_at', new Date(Date.now() - 60_000).toISOString());
  if (error) return fail('ร้านยังไม่พร้อมใช้งานค้นหา OTP', 503);
  if ((count ?? 0) >= PER_MINUTE) return fail('ค้นหาบ่อยเกินไป กรุณารอสักครู่', 429);

  // ร้านจำกัดการรับรหัสต่ออีเมล
  const blocked = await otpCustBlocked(shopId, account);
  if (blocked) return fail(blocked, 429);

  const log = (found: boolean) => d.from('shop_otp_requests').insert({ shop_id: shopId, customer_id: c.me.id, account, app: app.name, found, ...(pick?.limit ? { order_item_id: pick.itemId } : {}) });
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
