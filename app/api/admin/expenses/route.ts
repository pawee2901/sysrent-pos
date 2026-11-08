import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { body, fail, requireAdmin } from '@/lib/api';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ไม่ถูกต้อง'),
    category: z.string().trim().min(1, 'เลือกหมวดรายจ่าย').max(40),
    note: z.string().trim().max(200).default(''),
    amount: z.number().positive('จำนวนเงินต้องมากกว่า 0').max(10_000_000),
  }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
]);

/** รายจ่ายอื่นของร้าน (จดเอง): เพิ่ม · ลบ */
export async function POST(req: Request) {
  const a = await requireAdmin('accounting');
  if ('res' in a) return a.res;
  if (!can(a.shop.plan, 'accounting')) return fail('ระบบบัญชีอยู่ในแพ็กเกจ Max', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), x = b.data;
  if (x.action === 'add') {
    const { error } = await d.from('shop_expenses').insert({ shop_id: a.shop.id, spent_on: x.spent_on, category: x.category, note: x.note ?? '', amount: Math.round(x.amount * 100) / 100 });
    return error ? fail(/shop_expenses/.test(error.message) ? 'ยังไม่ได้รัน SQL 0019_accounting.sql' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  const { data } = await d.from('shop_expenses').delete().eq('id', x.id).eq('shop_id', a.shop.id).select('id');
  return data?.length ? NextResponse.json({ ok: true }) : fail('ไม่พบรายการ', 404);
}
