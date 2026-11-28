import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { notifySignup } from '@/lib/notify';
import { body, fail, requireShop } from '@/lib/api';
import { isHuman } from '@/lib/turnstile';
import { clientIp, endSession, getCustomer, hashPassword, loginFailed, loginLocked, loginOk, startSession, verifyPassword } from '@/lib/auth';

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, 'ชื่อผู้ใช้ใช้ได้แค่ a-z, 0-9, _ ยาว 3–20 ตัว'),
  password: z.string().min(6, 'รหัสผ่านอย่างน้อย 6 ตัว').max(72),
  contact: z.string().trim().max(60).optional().default(''),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง').max(120)]).optional().default(''),
  turnstile: z.string().max(2048).optional(),
});
// เข้าสู่ระบบ: ชื่อผู้ใช้หลวม ๆ (ชื่อบัญชีหลังบ้านของร้านอาจมีตัวอักษรนอก a-z0-9_)
const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'กรอกชื่อผู้ใช้').max(40),
  password: z.string().min(1, 'กรอกรหัสผ่าน').max(72),
  turnstile: z.string().max(2048).optional(),
});
const emailSchema = z.object({ email: z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง').max(120) });

const pwSchema = z.object({
  current: z.string().min(1, 'กรอกรหัสผ่านเดิม').max(72),
  password: z.string().min(6, 'รหัสผ่านใหม่อย่างน้อย 6 ตัว').max(72),
});

type Ctx ={ params: Promise<{ action: string }> };

/** POST /api/auth/register · /login · /logout · /password (ลูกค้าของร้าน) */
export async function POST(req: Request, { params }: Ctx) {
  const { action } = await params;
  const s = await requireShop();
  if ('res' in s) return s.res;
  const shop = s.shop;

  if (action === 'logout') { await endSession('customer'); return NextResponse.json({ ok: true }); }
  if (action === 'email') {
    const me = await getCustomer();
    if (!me) return fail('กรุณาเข้าสู่ระบบ', 401);
    const p = await body(req, emailSchema);
    if ('res' in p) return p.res;
    const { error } = await db().from('shop_customers').update({ email: p.data.email }).eq('id', me.id).eq('shop_id', shop.id);
    return error ? fail(/email/.test(error.message) ? 'ร้านยังไม่เปิดระบบอีเมล (ยังไม่ได้รัน SQL 0020)' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (action === 'password') {
    const me = await getCustomer();
    if (!me) return fail('กรุณาเข้าสู่ระบบ', 401);
    const p = await body(req, pwSchema);
    if ('res' in p) return p.res;
    const keys = [`${shop.id}:pw:${me.id}`];
    if (await loginLocked(keys)) return fail('ลองผิดหลายครั้งเกินไป กรุณารอ 15 นาที', 429);
    const d = db();
    const { data: c } = await d.from('shop_customers').select('pass_hash').eq('id', me.id).eq('shop_id', shop.id).maybeSingle();
    if (!c || !(await verifyPassword(p.data.current, c.pass_hash))) { await loginFailed(keys); return fail('รหัสผ่านเดิมไม่ถูกต้อง', 400); }
    await loginOk(keys);
    const { error } = await d.from('shop_customers').update({ pass_hash: await hashPassword(p.data.password) }).eq('id', me.id).eq('shop_id', shop.id);
    return error ? fail('บันทึกไม่สำเร็จ กรุณาลองใหม่', 500) : NextResponse.json({ ok: true });
  }
  if (action !== 'login' && action !== 'register') return fail('ไม่พบ', 404);

  const b = action === 'register' ? await body(req, schema) : await body(req, loginSchema);
  if ('res' in b) return b.res;
  const { username, password } = b.data;
  const reg = action === 'register' ? (b.data as z.infer<typeof schema>) : null;
  const contact = reg?.contact ?? '', email = reg?.email ?? '';
  const d = db();
  const ip = await clientIp();
  const keys = [`${shop.id}:ip:${ip}`, `${shop.id}:u:${username}`];
  if (await loginLocked(keys)) return fail('ลองผิดหลายครั้งเกินไป กรุณารอ 15 นาที', 429);
  if (!(await isHuman(b.data.turnstile, ip))) return fail('กรุณายืนยันว่าคุณเป็นมนุษย์ แล้วลองอีกครั้ง', 403);

  if (action === 'register') {
    const { count } = await d.from('shop_customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
    if ((count ?? 0) > 200) return fail('มีการสมัครจำนวนมาก กรุณาลองใหม่ภายหลัง', 429);
    const { data, error } = await d.from('shop_customers').insert({ shop_id: shop.id, username, pass_hash: await hashPassword(password), contact }).select('id').single();
    if (error) return error.code === '23505' ? fail('ชื่อผู้ใช้นี้มีคนใช้แล้ว', 409) : fail('สมัครไม่สำเร็จ กรุณาลองใหม่', 500);
    if (email) await d.from('shop_customers').update({ email }).eq('id', data.id); // แยกคำสั่ง: ยังไม่รัน 0020 ก็สมัครได้
    await startSession(shop.id, data.id, 30);
    notifySignup(shop, username, contact ?? "");
    return NextResponse.json({ ok: true });
  }

  const { data: c } = await d.from('shop_customers').select('id, pass_hash, blocked').eq('shop_id', shop.id).eq('username', username).maybeSingle();
  if (!c || !(await verifyPassword(password, c.pass_hash))) {
    // ไม่ใช่ลูกค้า → ลองบัญชีหลังบ้านของร้าน (ชื่อ + รหัสเดียวกับหน้าเข้าหลังบ้าน) = เข้าหลังบ้านเลย
    const { data: s } = await d.from('shops').select('admin_username, admin_pass_hash').eq('id', shop.id).single();
    if (s?.admin_pass_hash && s.admin_username.toLowerCase() === username && await verifyPassword(password, s.admin_pass_hash)) {
      await loginOk([...keys, `${shop.id}:admin:${ip}`, `${shop.id}:admin`]);
      await startSession(shop.id, null, 7);
      return NextResponse.json({ ok: true, admin: true });
    }
    await loginFailed(keys);
    return fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
  }
  if (c.blocked) return fail('บัญชีนี้ถูกระงับ กรุณาติดต่อร้าน', 403);
  await loginOk(keys);
  await startSession(shop.id, c.id, 30);
  return NextResponse.json({ ok: true });
}
