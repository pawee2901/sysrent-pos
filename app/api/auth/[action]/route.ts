import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireShop } from '@/lib/api';
import { clientIp, endSession, hashPassword, loginFailed, loginLocked, loginOk, startSession, verifyPassword } from '@/lib/auth';

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, 'ชื่อผู้ใช้ใช้ได้แค่ a-z, 0-9, _ ยาว 3–20 ตัว'),
  password: z.string().min(6, 'รหัสผ่านอย่างน้อย 6 ตัว').max(72),
  contact: z.string().trim().max(60).optional().default(''),
});

type Ctx = { params: Promise<{ action: string }> };

/** POST /api/auth/register · /api/auth/login · /api/auth/logout (ลูกค้าของร้าน) */
export async function POST(req: Request, { params }: Ctx) {
  const { action } = await params;
  const s = await requireShop();
  if ('res' in s) return s.res;
  const shop = s.shop;

  if (action === 'logout') { await endSession('customer'); return NextResponse.json({ ok: true }); }
  if (action !== 'login' && action !== 'register') return fail('ไม่พบ', 404);

  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const { username, password, contact } = b.data;
  const d = db();
  const ip = await clientIp();
  const keys = [`${shop.id}:ip:${ip}`, `${shop.id}:u:${username}`];
  if (await loginLocked(keys)) return fail('ลองผิดหลายครั้งเกินไป กรุณารอ 15 นาที', 429);

  if (action === 'register') {
    const { count } = await d.from('shop_customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
    if ((count ?? 0) > 200) return fail('มีการสมัครจำนวนมาก กรุณาลองใหม่ภายหลัง', 429);
    const { data, error } = await d.from('shop_customers').insert({ shop_id: shop.id, username, pass_hash: await hashPassword(password), contact }).select('id').single();
    if (error) return error.code === '23505' ? fail('ชื่อผู้ใช้นี้มีคนใช้แล้ว', 409) : fail('สมัครไม่สำเร็จ กรุณาลองใหม่', 500);
    await startSession(shop.id, data.id, 30);
    return NextResponse.json({ ok: true });
  }

  const { data: c } = await d.from('shop_customers').select('id, pass_hash, blocked').eq('shop_id', shop.id).eq('username', username).maybeSingle();
  if (!c || !(await verifyPassword(password, c.pass_hash))) {
    await loginFailed(keys);
    return fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
  }
  if (c.blocked) return fail('บัญชีนี้ถูกระงับ กรุณาติดต่อร้าน', 403);
  await loginOk(keys);
  await startSession(shop.id, c.id, 30);
  return NextResponse.json({ ok: true });
}
