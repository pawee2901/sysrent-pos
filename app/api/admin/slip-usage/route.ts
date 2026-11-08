import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api';

const month = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7); // เดือนตามเวลาไทย (ตรงกับ shop_use_slip)

/** จำนวนสลิปที่ตรวจไปแล้วเดือนนี้ + เรื่องแจ้งปัญหาที่ยังเปิดอยู่ — แถบซ้ายหลังบ้านดึงใหม่ทุกครั้งที่เปลี่ยนหน้า (layout ไม่โหลดใหม่เอง) */
export async function GET() {
  const a = await requireAdmin();
  if ('res' in a) return a.res;
  const [{ data }, rep, queue] = await Promise.all([
    db().from('shop_slip_usage').select('used').eq('shop_id', a.shop.id).eq('month', month()).maybeSingle(),
    db().from('shop_reports').select('id', { count: 'exact', head: true }).eq('shop_id', a.shop.id).eq('status', 'open'), // ยังไม่รัน 0013 = 0
    db().from('shop_order_items').select('id, shop_orders!inner(shop_id)', { count: 'exact', head: true }).eq('status', 'queued').eq('shop_orders.shop_id', a.shop.id),
  ]);
  return NextResponse.json({ ok: true, used: data?.used ?? 0, reports: rep.error ? 0 : rep.count ?? 0, queue: queue.count ?? 0 });
}
