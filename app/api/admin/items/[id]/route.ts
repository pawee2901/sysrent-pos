import { pushItem } from '@/lib/push';
import { NextResponse, after } from 'next/server';
import { lineItemNotice } from '@/lib/line-shop';
import { z } from 'zod';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { MAIL_RESULT, sendItemMail } from '@/lib/customer-mail';
import { body, fail, isUuid, requireAdmin } from '@/lib/api';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['deliver', 'refund']), content: z.string().trim().min(1, 'ใส่รายละเอียดก่อน').max(4000), mail: z.boolean().default(true) }),
  z.object({ action: z.literal('notify') }), // ส่งอีเมลแจ้งว่าทำเสร็จแล้วซ้ำ (สินค้าสั่งทำที่ส่งของแล้ว)
  // แก้ข้อมูลที่ส่งไปแล้ว (พิมพ์ผิด / เปลี่ยนรหัสให้) — ลูกค้าเห็นของใหม่ในหน้าประวัติทันที
  z.object({ action: z.literal('edit'), content: z.string().trim().min(1, 'ข้อมูลว่างไม่ได้').max(4000) }),
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

  if (b.data.action === 'edit') {
    const { data: it } = await db().from('shop_order_items').select('status, fulfillment, shop_orders!inner(shop_id)').eq('id', id).eq('shop_orders.shop_id', a.shop.id).maybeSingle();
    if (!it) return fail('ไม่พบรายการ', 404);
    if (it.fulfillment === 'slot') return fail('สินค้าแบบแบ่งจอ แก้รหัสได้ที่หน้าแจ้งปัญหา / สต็อก', 400);
    if (it.status !== 'delivered') return fail('รายการนี้ยังไม่ได้ส่งของ', 400);
    // ไม่แตะ updated_at: สินค้าสั่งทำนับประกันจากเวลาส่งของ
    const { error } = await db().from('shop_order_items').update({ delivered: b.data.content }).eq('id', id);
    return error ? fail('บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (b.data.action === 'notify') {
    if (!can(a.shop.plan, 'mail')) return fail('อีเมลแจ้งลูกค้าใช้ได้กับแพ็กเกจ Pro ขึ้นไป', 403);
    const { data: it } = await db().from('shop_order_items').select('status, fulfillment, shop_orders!inner(shop_id)').eq('id', id).eq('shop_orders.shop_id', a.shop.id).maybeSingle();
    if (!it) return fail('ไม่พบรายการ', 404);
    if (it.fulfillment !== 'manual' || it.status !== 'delivered') return fail('ส่งอีเมลแจ้งได้เฉพาะสินค้าสั่งทำที่ส่งของแล้ว', 400);
    const r = await sendItemMail(a.shop, id, 'deliver', '');
    return r === 'sent' ? NextResponse.json({ ok: true }) : fail(MAIL_RESULT[r], r === 'failed' ? 502 : 409);
  }

  const fn = b.data.action === 'deliver' ? 'shop_deliver_item' : 'shop_refund_item';
  const args = b.data.action === 'deliver' ? { p_shop: a.shop.id, p_item: id, p_content: b.data.content } : { p_shop: a.shop.id, p_item: id, p_reason: b.data.content.slice(0, 300) };
  const { error } = await db().rpc(fn, args);
  if (error) return /NOT_OPEN/.test(error.message) ? fail('รายการนี้ถูกจัดการไปแล้ว', 409) : /NOT_FOUND/.test(error.message) ? fail('ไม่พบรายการ', 404) : fail('บันทึกไม่สำเร็จ', 500);
  // ลูกค้าที่สั่งผ่าน LINE ร้าน → แจ้งในแชท LINE ด้วย (หลังตอบแอดมินแล้ว)
  const { action, content } = b.data;
  after(() => lineItemNotice(a.shop, id, action, content).catch((e) => console.error('[line] item notice', e)));
  // แจ้งเตือนในแอปร้าน (ลูกค้าที่เปิดรับแจ้งเตือนไว้)
  after(() => pushItem(a.shop, id, action).catch((e) => console.error('[push] item', e)));
  // รอผลอีเมลเพื่อบอกแอดมินทันที · ส่งไม่ได้ก็ยังถือว่าส่งของ / คืนเงินสำเร็จ
  const mail = b.data.mail && can(a.shop.plan, 'mail') ? await sendItemMail(a.shop, id, b.data.action, b.data.content) : null;
  return NextResponse.json({ ok: true, mail: mail && { sent: mail === 'sent', message: MAIL_RESULT[mail] } });
}
