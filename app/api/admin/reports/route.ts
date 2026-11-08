import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';

const schema = z.discriminatedUnion('action', [
  // ตอบกลับ / ปิดเรื่อง (ลูกค้าเห็นคำตอบในหน้าประวัติ)
  z.object({ action: z.literal('reply'), id: z.string().uuid(), reply: z.string().trim().max(1000).default(''), resolve: z.boolean().default(false) }),
  // แก้ไอดีที่ส่งให้ลูกค้าแล้ว (เปลี่ยนรหัส / เมลใหม่) — ลูกค้าเห็นของใหม่ทันทีในหน้าประวัติ
  z.object({ action: z.literal('edit_item'), itemId: z.string().uuid(), delivered: z.string().trim().min(1, 'ไอดีว่างไม่ได้').max(4000) }),
]);

export async function POST(req: Request) {
  const a = await requireAdmin('reports');
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), x = b.data;

  if (x.action === 'edit_item') {
    // รายการต้องเป็นของร้านนี้ และส่งของไปแล้ว (แบบแบ่งจอแก้ที่คลังบัญชี เพราะรหัสใช้ร่วมกันหลายจอ)
    const { data: it } = await d.from('shop_order_items').select('id, status, fulfillment, shop_orders!inner(shop_id)').eq('id', x.itemId).eq('shop_orders.shop_id', a.shop.id).maybeSingle();
    if (!it) return fail('ไม่พบรายการ', 404);
    if (it.fulfillment === 'slot') return fail('สินค้าแบบแบ่งจอ แก้รหัสที่เมนู "คลังบัญชี"', 400);
    if (it.status !== 'delivered') return fail('รายการนี้ยังไม่ได้ส่งของ — ส่งของที่หน้าออเดอร์', 400);
    const { error } = await d.from('shop_order_items').update({ delivered: x.delivered }).eq('id', x.itemId); // ไม่แตะ updated_at: สินค้าสั่งทำนับประกันจากเวลาส่งของ
    return error ? fail('บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }

  const upd: Record<string, unknown> = { reply: x.reply };
  if (x.resolve) { upd.status = 'resolved'; upd.resolved_at = new Date().toISOString(); }
  const { data, error } = await d.from('shop_reports').update(upd).eq('id', x.id).eq('shop_id', a.shop.id).select('id');
  if (error) return fail('บันทึกไม่สำเร็จ', 500);
  return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบเรื่องนี้', 404);
}
