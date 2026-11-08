import 'server-only';
import { db } from '@/lib/db';

/**
 * ยอดมีเศษสตางค์ไม่ซ้ำ (เช่น 100 → 100.37) ใช้เมื่อร้านเปิดรับเงินจากแจ้งเตือนธนาคาร (shops.bank_hook_hash)
 * ตอนนี้ปิดหน้าตั้งค่านี้ไว้ (ใช้ Thunder ตรวจสลิปแทน) → bankAutoOn = false เสมอ ถ้าไม่มีใครตั้งค่าในฐานข้อมูลเอง
 */

/** ร้านเปิดรับเงินอัตโนมัติไหม (ยังไม่รัน 0008 = ไม่เปิด) */
export async function bankAutoOn(shopId: string): Promise<boolean> {
  const { data, error } = await db().from('shops').select('bank_hook_hash').eq('id', shopId).maybeSingle();
  return !error && !!data?.bank_hook_hash;
}

/** เลือกยอดมีเศษสตางค์ที่ยังไม่มีใครรอโอนอยู่ */
export async function uniqueAmount(shopId: string, base: number): Promise<number[]> {
  const lo = Math.floor(base), hi = lo + 2;
  const { data } = await db().from('shop_topups').select('amount').eq('shop_id', shopId).eq('status', 'pending').gte('amount', lo).lt('amount', hi);
  const taken = new Set((data ?? []).map((r) => Number(r.amount).toFixed(2)));
  const picks: number[] = [];
  const order = Array.from({ length: 99 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  for (const s of order) {
    const v = Math.round((base + s / 100) * 100) / 100;
    if (!taken.has(v.toFixed(2))) picks.push(v);
    if (picks.length >= 5) break;
  }
  return picks;
}
