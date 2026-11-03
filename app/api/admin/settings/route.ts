import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { hashPassword } from '@/lib/auth';

const https = (max: number) => z.string().trim().max(max).refine((u) => !u || /^https:\/\//.test(u), 'ลิงก์ต้องขึ้นต้นด้วย https://');
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('shop'),
    name: z.string().trim().min(1, 'ใส่ชื่อร้าน').max(40), tagline: z.string().trim().max(60), logo_url: https(500),
    accent: z.enum(['indigo', 'pink', 'emerald', 'orange', 'sky']), line_url: https(200), announcement: z.string().trim().max(120),
    promptpay_id: z.string().regex(/^(\d{10}|\d{13}|\d{15})?$/, 'พร้อมเพย์ต้องเป็นเบอร์ 10 หลัก, เลข 13 หลัก หรือ e-Wallet 15 หลัก'),
    receiver_name: z.string().trim().max(200),
  }),
  z.object({ action: z.literal('admin'), username: z.string().trim().min(3, 'ชื่อผู้ดูแลอย่างน้อย 3 ตัว').max(40), password: z.string().min(8, 'รหัสผ่านอย่างน้อย 8 ตัว').max(72) }),
]);

export async function POST(req: Request) {
  const a = await requireAdmin();
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db();
  if (b.data.action === 'shop') {
    const { action: _a, ...upd } = b.data;
    const { error } = await d.from('shops').update(upd).eq('id', a.shop.id);
    if (error) return fail('บันทึกไม่สำเร็จ', 500);
    return NextResponse.json({ ok: true });
  }
  await d.from('shops').update({ admin_username: b.data.username, admin_pass_hash: await hashPassword(b.data.password) }).eq('id', a.shop.id);
  // เปลี่ยนรหัสหลังบ้าน = ทุกเครื่องที่ล็อกอินหลังบ้านอยู่ต้องเข้าใหม่ (ยกเว้นลูกค้า)
  await d.from('shop_sessions').delete().eq('shop_id', a.shop.id).is('customer_id', null);
  return NextResponse.json({ ok: true });
}
