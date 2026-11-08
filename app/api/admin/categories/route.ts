import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';

const name = z.string().trim().min(1, 'ใส่ชื่อหมวด').max(30, 'ชื่อหมวดยาวไม่เกิน 30 ตัว');
const schema = z.object({
  list: z.array(name).max(40, 'มีหมวดได้สูงสุด 40 หมวด'),
  rename: z.object({ from: name, to: name }).optional(),   // เปลี่ยนชื่อ → สินค้าในหมวดนั้นย้ายตาม
  remove: name.optional(),                                 // ลบ → สินค้าในหมวดนั้นกลายเป็น "ไม่มีหมวด"
});

/** บันทึกรายการหมวดหมู่ (ลำดับ = ลำดับบนหน้าร้าน) */
export async function POST(req: Request) {
  const a = await requireAdmin('products');
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const { list, rename, remove } = b.data;
  if (new Set(list).size !== list.length) return fail('มีชื่อหมวดซ้ำกัน');
  const d = db(), sid = a.shop.id;

  const { error } = await d.from('shops').update({ categories: list }).eq('id', sid);
  if (error) return fail(error.message.includes('categories') ? 'ยังไม่ได้รัน SQL 0007_shop_categories.sql' : 'บันทึกไม่สำเร็จ', 500);
  if (rename && rename.from !== rename.to) await d.from('shop_products').update({ category: rename.to }).eq('shop_id', sid).eq('category', rename.from);
  if (remove) await d.from('shop_products').update({ category: '' }).eq('shop_id', sid).eq('category', remove);
  return NextResponse.json({ ok: true });
}
