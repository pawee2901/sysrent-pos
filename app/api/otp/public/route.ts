import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { body, fail } from '@/lib/api';
import { getShop } from '@/lib/shop';
import { otpAccounts } from '@/lib/otp-access';
import { otpAgent, otpCustBlocked, otpLink, otpPublic } from '@/lib/otp-link';
import { clientIp as ipOf, loginFailed, loginLocked, loginOk } from '@/lib/auth';
import { ACCESS_LABEL, PERIOD_MS, normalizeAccess, type OtpAccess } from '@/lib/otp-agent';
import { OtpMailboxError, searchOtp } from '@/lib/otp-search';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// code = รหัสยืนยันของระบบตัวแทน (รหัส 4 หลัก / ชื่อยูส / อีเมลตัวแทน)
const schema = z.object({ account: z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง').max(120), appId: z.string().uuid(), code: z.string().trim().max(120).optional() });
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
  const { account, appId, code = '' } = b.data, d = db(), shopId = shop.id, ip = await ipOf();

  const recent = (ms: number) => d.from('shop_otp_requests').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('ip', ip).gte('created_at', new Date(Date.now() - ms).toISOString());
  const [m, h] = await Promise.all([recent(60_000), recent(3_600_000)]);
  if (m.error) return fail('ร้านยังไม่พร้อมใช้งานหน้ารับ OTP', 503);
  if ((m.count ?? 0) >= PER_MINUTE || (h.count ?? 0) >= PER_HOUR) return fail('ค้นหาบ่อยเกินไป กรุณารอสักครู่', 429);

  const { data: app } = await d.from('shop_otp_apps').select('name, keywords, code').eq('id', appId).eq('shop_id', shopId).maybeSingle();
  if (!app) return fail('ไม่พบแอปนี้', 404);
  let accessId: string | null = null;
  const log = (found: boolean) => d.from('shop_otp_requests').insert({ shop_id: shopId, customer_id: null, ip, account, app: app.name, found, ...(accessId ? { access_id: accessId } : {}) });

  if (await otpAgent(shopId)) {
    // ระบบตัวแทน: อีเมล + รหัสยืนยันที่ร้านตั้งให้ (กรอกผิด 5 ครั้ง ล็อก 15 นาที ต่อ IP และต่ออีเมล)
    const keys = [`otp:${shopId}:${ip}`, `otp:${shopId}:${account}`];
    if (await loginLocked(keys)) return fail('กรอกรหัสผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่', 429);
    const { data: rows, error: ae } = await d.from('shop_otp_access').select('id, email, label, kind, secret, use_limit, period, active').eq('shop_id', shopId).eq('email', account);
    if (ae) return fail('ร้านยังไม่พร้อมใช้งานระบบตัวแทน', 503);
    const list = (rows ?? []) as OtpAccess[];
    if (!list.length) return fail('อีเมลนี้ยังไม่ได้รับรหัสจากร้าน กรุณาติดต่อแอดมินร้าน', 403);
    if (!code) return fail(`กรุณากรอก${[...new Set(list.map((r) => ACCESS_LABEL[r.kind]))].join(' / ')}ที่ได้จากร้าน`, 401);
    const hit = list.find((r) => normalizeAccess(r.kind, code) === r.secret);
    if (!hit) { await loginFailed(keys); return fail('รหัสยืนยันไม่ถูกต้อง', 401); }
    await loginOk(keys);
    if (!hit.active) return fail('รหัสนี้ถูกปิดใช้งานชั่วคราว กรุณาติดต่อแอดมินร้าน', 403);
    if (hit.use_limit > 0) {
      const { count } = await d.from('shop_otp_requests').select('id', { count: 'exact', head: true }).eq('access_id', hit.id).eq('found', true).gte('created_at', new Date(Date.now() - PERIOD_MS[hit.period]).toISOString());
      if ((count ?? 0) >= hit.use_limit) return fail(`รับรหัสครบ ${hit.use_limit} ครั้งแล้ว (ต่อ${hit.period === 'day' ? 'วัน' : hit.period === 'week' ? 'สัปดาห์' : 'เดือน'}) กรุณาติดต่อแอดมินร้าน`, 429);
    }
    accessId = hit.id;
  } else {
    const allowed = await otpAccounts(shopId);
    if (!allowed.some((a) => a.email === account)) { await log(false); return fail('ไม่พบอีเมลนี้ในสินค้าของร้านที่ยังไม่หมดอายุ', 403); }
    const blocked = await otpCustBlocked(shopId, account);
    if (blocked) return fail(blocked, 429);
  }

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
