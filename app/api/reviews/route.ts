import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireCustomer } from '@/lib/api';

const schema = z.object({ itemId: z.string().uuid(), stars: z.number().int().min(1, 'เลือกจำนวนดาว').max(5), body: z.string().trim().max(1000).default('') });

/** ลูกค้ารีวิวสินค้าที่ได้ของแล้ว (รายการละ 1 รีวิว · ส่งซ้ำ = แก้ไข) */
export async function POST(req: Request) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db();
  const { data: it } = await d.from('shop_order_items').select('id, product_id, status, shop_orders!inner(shop_id, customer_id)').eq('id', b.data.itemId).maybeSingle();
  const o = it?.shop_orders as unknown as { shop_id: string; customer_id: string } | undefined;
  if (!it || !o || o.shop_id !== a.shop.id || o.customer_id !== a.me.id) return fail('ไม่พบรายการนี้', 404);
  if (it.status !== 'delivered') return fail('รีวิวได้เมื่อได้รับของแล้ว', 400);
  const { error } = await d.from('shop_reviews').upsert({
    shop_id: a.shop.id, product_id: it.product_id, order_item_id: it.id, customer_id: a.me.id, stars: b.data.stars, body: b.data.body, updated_at: new Date().toISOString(),
  }, { onConflict: 'order_item_id' });
  if (error) return fail(/shop_reviews/.test(error.message) ? 'ร้านยังไม่เปิดระบบรีวิว' : 'บันทึกรีวิวไม่สำเร็จ', 500);
  return NextResponse.json({ ok: true });
}
