import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { mailItemResult, sendItemMail } from '@/lib/customer-mail';
import { body, fail, isUuid, requireAdmin } from '@/lib/api';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['deliver', 'refund']), content: z.string().trim().min(1, 'ใส่รายละเอียดก่อน').max(4000), mail: z.boolean().default(true) }),
  z.object({ action: z.literal('notify') }), // ส่งอีเมลแจ้งว่าทำเสร็จแล้วซ้ำ (สินค้าสั่งทำที่ส่งของแล้ว)
]);
type Ctx = { params: Promise<{ id: string }> };

/** ส่งของเอง (สินค้าสั่งทำ) / คืนเงินเข้ากระเป๋าลูกค้า / ส่งอีเมลแจ้งซ้ำ — เฉพาะรายการของร้านนี้ */
export async function POST(req: Request, { params }: Ctx) {
  const a = await requireAdmin('orders');
  if ('res' in a) return a.res;
  const { id } = await params;
  if (!isUuid(id)) return fail('ไม่พบรายการ', 404);
  const b = await body(req, schema);
  if ('res' in b) return b.res;

  if (b.data.action === 'notify') {
    if (!can(a.shop.plan, 'mail')) return fail('อีเมลแจ้งลูกค้าใช้ได้กับแพ็กเกจ Pro ขึ้นไป', 403);
    const { data: it } = await db().from('shop_order_items').select('status, fulfillment, shop_orders!inner(shop_id)').eq('id', id).eq('shop_orders.shop_id', a.shop.id).maybeSingle();
    if (!it) return fail('ไม่พบรายการ', 404);
    if (it.fulfillment !== 'manual' || it.status !== 'delivered') return fail('ส่งอีเมลแจ้งได้เฉพาะสินค้าสั่งทำที่ส่งของแล้ว', 400);
    const r = await sendItemMail(a.shop, id, 'deliver', '');
    if (r === 'no_email') return fail('ลูกค้ายังไม่ได้ใส่อีเมลในบัญชี', 409);
    return r === 'sent' ? NextResponse.json({ ok: true }) : fail('ส่งอีเมลไม่สำเร็จ ตรวจการตั้งค่า Gmail ของร้าน', 502);
  }

  const fn = b.data.action === 'deliver' ? 'shop_deliver_item' : 'shop_refund_item';
  const args = b.data.action === 'deliver' ? { p_shop: a.shop.id, p_item: id, p_content: b.data.content } : { p_shop: a.shop.id, p_item: id, p_reason: b.data.content.slice(0, 300) };
  const { error } = await db().rpc(fn, args);
  if (error) return /NOT_OPEN/.test(error.message) ? fail('รายการนี้ถูกจัดการไปแล้ว', 409) : /NOT_FOUND/.test(error.message) ? fail('ไม่พบรายการ', 404) : fail('บันทึกไม่สำเร็จ', 500);
  if (b.data.mail) mailItemResult(a.shop, id, b.data.action, b.data.content);
  return NextResponse.json({ ok: true });
}
