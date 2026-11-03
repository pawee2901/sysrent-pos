import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireShop } from '@/lib/api';
import { clientIp, endSession, loginFailed, loginLocked, loginOk, startSession, verifyPassword } from '@/lib/auth';

const schema = z.union([
  z.object({ logout: z.literal(true) }),
  z.object({ username: z.string().trim().min(1).max(40), password: z.string().min(1).max(72) }),
]);

/** แอดมินร้านเข้าสู่ระบบ / ออกจากระบบ · ผิด 5 ครั้งล็อก 15 นาที */
export async function POST(req: Request) {
  const s = await requireShop();
  if ('res' in s) return s.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  if ('logout' in b.data) { await endSession('admin'); return NextResponse.json({ ok: true }); }
  const keys = [`${s.shop.id}:admin:${await clientIp()}`, `${s.shop.id}:admin`];
  if (await loginLocked(keys)) return fail('ลองผิดหลายครั้งเกินไป กรุณารอ 15 นาที', 429);
  const { data } = await db().from('shops').select('admin_username, admin_pass_hash').eq('id', s.shop.id).single();
  const ok = data?.admin_pass_hash && data.admin_username.toLowerCase() === b.data.username.toLowerCase() && await verifyPassword(b.data.password, data.admin_pass_hash);
  if (!ok) { await loginFailed(keys); return fail('ชื่อผู้ดูแลหรือรหัสผ่านไม่ถูกต้อง', 401); }
  await loginOk(keys);
  await startSession(s.shop.id, null, 7);
  return NextResponse.json({ ok: true });
}
