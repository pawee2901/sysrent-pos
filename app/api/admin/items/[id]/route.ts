import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, isUuid, requireAdmin } from '@/lib/api';

const schema = z.object({ action: z.enum(['deliver', 'refund']), content: z.string().trim().min(1, 'ใส่รายละเอียดก่อน').max(4000) });
type Ctx = { params: Promise<{ id: string }> };

/** ส่งของเอง (สินค้าสั่งทำ) / คืนเงินเข้ากระเป๋าลูกค้า — เฉพาะรายการที่รอส่งของร้านนี้ */
export async function POST(req: Request, { params }: Ctx) {
  const a = await requireAdmin();
  if ('res' in a) return a.res;
  const { id } = await params;
  if (!isUuid(id)) return fail('ไม่พบรายการ', 404);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const fn = b.data.action === 'deliver' ? 'shop_deliver_item' : 'shop_refund_item';
  const args = b.data.action === 'deliver' ? { p_shop: a.shop.id, p_item: id, p_content: b.data.content } : { p_shop: a.shop.id, p_item: id, p_reason: b.data.content.slice(0, 300) };
  const { error } = await db().rpc(fn, args);
  if (error) return /NOT_OPEN/.test(error.message) ? fail('รายการนี้ถูกจัดการไปแล้ว', 409) : /NOT_FOUND/.test(error.message) ? fail('ไม่พบรายการ', 404) : fail('บันทึกไม่สำเร็จ', 500);
  return NextResponse.json({ ok: true });
}
