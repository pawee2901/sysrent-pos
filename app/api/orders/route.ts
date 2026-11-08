import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { shopOpen } from '@/lib/shop';
import { body, dbFail, fail, requireCustomer } from '@/lib/api';

const schema = z.object({
  lines: z.array(z.object({ optionId: z.string().uuid(), qty: z.number().int().min(1).max(20), info: z.string().trim().max(300).optional() })).min(1, 'ตะกร้ายังว่างอยู่').max(20),
  coupon: z.string().trim().toUpperCase().max(20).optional(),
});

/** สร้างออเดอร์จากตะกร้า — ราคา / สต็อก / ข้อมูลที่ร้านขอ / คูปอง ตรวจในฐานข้อมูลทั้งหมด */
export async function POST(req: Request) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  if (!shopOpen(a.shop)) return fail('ร้านปิดรับออเดอร์ชั่วคราว', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db();
  const { count } = await d.from('shop_orders').select('id', { count: 'exact', head: true })
    .eq('customer_id', a.me.id).eq('status', 'pending').gt('expires_at', new Date().toISOString());
  if ((count ?? 0) >= 5) return fail('มีออเดอร์รอชำระหลายรายการ กรุณาชำระหรือรอให้หมดเวลาก่อน', 429);

  const { data, error } = await d.rpc('shop_create_order', { p_shop: a.shop.id, p_customer: a.me.id, p_lines: b.data.lines.map((l) => ({ option_id: l.optionId, qty: l.qty, info: l.info ?? '' })), p_coupon: b.data.coupon || null });
  if (error || !data) return dbFail(error?.message);


  return NextResponse.json({ ok: true, code: (data as { code: string }).code });
}
