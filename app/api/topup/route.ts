import { NextResponse } from 'next/server';
import { z } from 'zod';
import { body, fail, requireCustomer } from '@/lib/api';
import { createTopup } from '@/lib/topup';

const schema = z.object({ amount: z.number().int('จำนวนเงินต้องเป็นจำนวนเต็ม').min(10, 'เติมขั้นต่ำ 10 บาท').max(50_000, 'เติมได้สูงสุด 50,000 บาท') });

/** เติมเงินเข้ากระเป๋าในร้าน → QR พร้อมเพย์ของร้าน */
export async function POST(req: Request) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const t = await createTopup(a.shop, a.me.id, b.data.amount, null);
  if ('error' in t) return fail(t.error, t.status);
  return NextResponse.json({ ok: true, ...t });
}
