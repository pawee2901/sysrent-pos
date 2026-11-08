import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { SLIP_QUOTA } from '@/lib/plan';
import { fail } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import { THEMES } from '@/lib/themes';

/**
 * API ภายในสำหรับ SysRent (เว็บหลัก) เท่านั้น — ต้องส่ง header x-internal-key = SHOP_INTERNAL_KEY
 *  GET  → รายชื่อ slug ร้านที่เปิดอยู่ (ใช้สร้าง nginx map)
 *  POST → create / extend / suspend / resume / check / themes (ปลดล็อกธีมพิเศษที่ซื้อจาก sysrent.shop)
 */
function authorized(req: Request): boolean {
  const want = process.env.SHOP_INTERNAL_KEY ?? '';
  const got = req.headers.get('x-internal-key') ?? '';
  if (want.length < 32 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const RESERVED = new Set(['www', 'api', 'admin', 'app', 'mail', 'shop', 'shops', 'otp', 'sysrent', 'static', 'cdn', 'help', 'support', 'status', 'dev', 'test', 'demo', 'demo-agent']);
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/, 'ชื่อร้าน (subdomain) ใช้ a-z 0-9 - ยาว 3-30 ตัว');
const until = z.string().datetime({ offset: true });

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('check'), slug }),
  z.object({
    action: z.literal('create'), slug, owner_id: z.string().uuid(), name: z.string().trim().min(1).max(40),
    admin_username: z.string().trim().min(3).max(40), expires_at: until,
    admin_password: z.string().min(8).max(72).optional(), // ส่งอย่างใดอย่างหนึ่ง
    admin_pass_hash: z.string().regex(/^s1\$[\w-]+\$[\w-]+$/).optional(),
    plan: z.enum(['starter', 'pro', 'max']).default('starter'),
    slip_quota: z.number().int().min(0).max(1000).optional(), // ร้านทดลอง: โควตาน้อยกว่าแพ็กเกจ
  }),
  z.object({ action: z.literal('extend'), slug, expires_at: until }),
  z.object({ action: z.enum(['suspend', 'resume']), slug }),
  // ธีมพิเศษทั้งหมดที่ร้านเป็นเจ้าของ (ส่งรายการเต็มทุกครั้ง — ไม่ได้ส่งมา = ถอนสิทธิ์)
  // เปลี่ยนแพ็กเกจ: starter (ปกติ ฿299) · pro (฿399) · max (฿799) — โควตาสลิปเปลี่ยนตามแพ็กเกจ
  z.object({ action: z.literal('plan'), slug, plan: z.enum(['starter', 'pro', 'max']) }),
  z.object({ action: z.literal('themes'), slug, themes: z.array(z.string().refine((k) => THEMES.some((t) => t.key === k && t.premium), 'ไม่มีธีมนี้')).max(50) }),
]);

/** ชื่อซ้ำกับเว็บเช่า OTP (sub เดียวกันบน sysrent) หรือร้านอื่นไม่ได้ */
async function slugTaken(s: string): Promise<string | null> {
  if (RESERVED.has(s)) return 'ชื่อนี้สงวนไว้ของระบบ';
  const d = db();
  const [{ count: a }, { count: b }] = await Promise.all([
    d.from('shops').select('id', { count: 'exact', head: true }).eq('slug', s),
    d.from('otp_tenants').select('id', { count: 'exact', head: true }).ilike('slug', s),
  ]);
  return (a ?? 0) + (b ?? 0) > 0 ? 'ชื่อนี้มีคนใช้แล้ว' : null;
}

export async function GET(req: Request) {
  if (!authorized(req)) return fail('forbidden', 403);
  const { data, error } = await db().from('shops').select('slug').eq('active', true).order('slug').limit(10000);
  if (error) return fail('db', 500);
  return NextResponse.json({ ok: true, slugs: (data ?? []).map((r) => r.slug) });
}

export async function POST(req: Request) {
  if (!authorized(req)) return fail('forbidden', 403);
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง', 400);
  const x = p.data, d = db();

  if (x.action === 'check') {
    const why = await slugTaken(x.slug);
    return NextResponse.json({ ok: true, available: !why, reason: why });
  }
  if (x.action === 'create') {
    const why = await slugTaken(x.slug);
    if (why) return fail(why, 409);
    const passHash = x.admin_pass_hash ?? (x.admin_password ? await hashPassword(x.admin_password) : '');
    if (!passHash) return fail('ต้องกำหนดรหัสผ่านผู้ดูแล', 400);
    const { data, error } = await d.from('shops').insert({
      slug: x.slug, owner_id: x.owner_id, name: x.name, admin_username: x.admin_username,
      admin_pass_hash: passHash, expires_at: x.expires_at, plan: x.plan, slip_quota: x.slip_quota ?? SLIP_QUOTA[x.plan], slip_overage: 0.45,
    }).select('id, slug').single();
    if (error) return fail(error.code === '23505' ? 'ชื่อนี้มีคนใช้แล้ว' : 'สร้างร้านไม่สำเร็จ', error.code === '23505' ? 409 : 500);
    return NextResponse.json({ ok: true, shop: data });
  }
  if (x.action === 'plan') {
    const { data } = await d.from('shops').update({ plan: x.plan, slip_quota: SLIP_QUOTA[x.plan] }).eq('slug', x.slug).select('id');
    return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบร้าน', 404);
  }
  if (x.action === 'themes') {
    const { data } = await d.from('shops').update({ themes_owned: [...new Set(x.themes)] }).eq('slug', x.slug).select('id');
    return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบร้าน', 404);
  }
  const upd = x.action === 'extend' ? { expires_at: x.expires_at, active: true } : { active: x.action === 'resume' };
  const { data } = await d.from('shops').update(upd).eq('slug', x.slug).select('id');
  if (!data?.length) return fail('ไม่พบร้าน', 404);
  return NextResponse.json({ ok: true });
}
