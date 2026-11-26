import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('hide'), id: z.string().uuid(), hidden: z.boolean() }),
  z.object({ action: z.literal('reply'), id: z.string().uuid(), reply: z.string().trim().max(1000) }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
]);

/** หลังบ้าน → รีวิว: ซ่อน / แสดง · ตอบกลับ · ลบ */
export async function POST(req: Request) {
  const a = await requireAdmin('reviews');
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db().from('shop_reviews');
  const x = b.data;
  const q = x.action === 'delete' ? d.delete() : d.update(x.action === 'hide' ? { hidden: x.hidden } : { reply: x.reply });
  const { data, error } = await q.eq('id', x.id).eq('shop_id', a.shop.id).select('id');
  if (error) return fail('บันทึกไม่สำเร็จ', 500);
  return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบรีวิวนี้', 404);
}
