import { NextResponse } from 'next/server';
import { fail, isUuid, requireCustomer } from '@/lib/api';
import { verifyTopupSlip } from '@/lib/topup-slip';

type Ctx = { params: Promise<{ id: string }> };

/** อัปสลิปจากหน้าเว็บร้าน — เงื่อนไขการตรวจทั้งหมดอยู่ใน lib/topup-slip.ts (ใช้ร่วมกับแชท LINE ของร้าน) */
export async function POST(req: Request, { params }: Ctx) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const { id } = await params;
  if (!isUuid(id)) return fail('ไม่พบรายการ', 404);
  const form = await req.formData().catch(() => null);
  const file = form?.get('slip');
  const r = await verifyTopupSlip(a.shop, { id: a.me.id, username: a.me.username }, id, file instanceof Blob ? file : null);
  if (!r.ok) return fail(r.error, r.status, r.expired ? { expired: true } : {});
  if (r.waiting) return NextResponse.json({ ok: true, waiting: true, message: r.message });
  if (r.order) return NextResponse.json({ ok: true, amount: r.amount, order: r.order });
  if (r.orderError) return NextResponse.json({ ok: true, amount: r.amount, balance: r.balance, orderError: r.orderError });
  return NextResponse.json({ ok: true, amount: r.amount, balance: r.balance });
}
