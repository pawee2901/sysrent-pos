import { NextResponse } from 'next/server';
import { z } from 'zod';
import { can } from '@/lib/plan';
import { body, fail, requireAdmin } from '@/lib/api';
import { encConfigured } from '@/lib/secret';
import { MS_CALLBACK_PATH, authorizeUrl, makeState, shopMsApp } from '@/lib/msgraph';

const schema = z.object({ hint: z.union([z.literal(''), z.string().trim().email().max(120)]).optional() });

/** ปุ่มเชื่อม Hotmail: คืนลิงก์ล็อกอิน Microsoft */
export async function POST(req: Request) {
  const a = await requireAdmin('otp');
  if ('res' in a) return a.res;
  if (!can(a.shop.plan, 'otp')) return fail('ค้นหา OTP อยู่ในแพ็กเกจ Max', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  if (!encConfigured()) return fail('ระบบยังไม่ได้ตั้ง ENC_KEY', 503);
  const app = await shopMsApp(a.shop.id);
  if (!app) return fail('ตั้ง Microsoft App ในแท็บตั้งค่า API ก่อน');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const { state, nonce } = makeState(a.shop.id);
  const res = NextResponse.json({ ok: true, url: authorizeUrl(app.clientId, host, state, b.data.hint || undefined) });
  res.cookies.set('ms_nonce', nonce, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: MS_CALLBACK_PATH });
  return res;
}
