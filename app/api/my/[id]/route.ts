import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, isUuid, requireCustomer } from '@/lib/api';
import { decrypt } from '@/lib/secret';

type Ctx = { params: Promise<{ id: string }> };

/** ลูกค้าเปิดดูรหัสจอที่ตัวเองเช่า — เฉพาะเจ้าของ + ยังไม่หมดอายุ (POST = ไม่ถูกแคช) */
export async function POST(_req: Request, { params }: Ctx) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const { id } = await params;
  if (!isUuid(id)) return fail('ไม่พบรายการ', 404);
  const { data: s } = await db().from('shop_subscriptions').select('status, ends_at, shop_slots(label, pin, shop_accounts(login, secret_enc, status))')
    .eq('id', id).eq('shop_id', a.shop.id).eq('customer_id', a.me.id).maybeSingle();
  if (!s) return fail('ไม่พบรายการ', 404);
  if (s.status !== 'active' || new Date(s.ends_at).getTime() <= Date.now()) return fail('หมดอายุแล้ว — ซื้อใหม่เพื่อดูรหัส', 410);
  const slot = s.shop_slots as unknown as { label: string; pin: string; shop_accounts: { login: string; secret_enc: string; status: string } };
  if (slot.shop_accounts.status === 'retired') return fail('บัญชีนี้ถูกเลิกใช้ กรุณาติดต่อร้าน', 410);
  let password: string;
  try { password = decrypt(slot.shop_accounts.secret_enc); } catch { return fail('ระบบขัดข้อง กรุณาติดต่อร้าน', 500); }
  return NextResponse.json({ login: slot.shop_accounts.login, password, profile: slot.label, pin: slot.pin }, { headers: { 'Cache-Control': 'no-store' } });
}
