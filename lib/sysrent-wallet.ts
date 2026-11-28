import 'server-only';
import { db } from '@/lib/db';

/** เติมเงินกระเป๋า SysRent (เว็บเช่า) — ค่าตรวจสลิปตัดจากกระเป๋านี้ */
export const SYSRENT_TOPUP = `${(process.env.SYSRENT_URL || 'https://sysrent.shop').replace(/\/$/, '')}/account/topup`;
/** กระเป๋าใกล้หมด (ตรวจสลิปได้อีกไม่กี่ใบ) */
export const WALLET_LOW = 10;

/** ยอดกระเป๋าเงิน SysRent ของเจ้าของร้าน (ตารางเดียวกับเว็บเช่า) · อ่านไม่ได้ / ไม่มีเจ้าของ = null */
export async function ownerWallet(ownerId: string | null | undefined): Promise<number | null> {
  if (!ownerId) return null;
  const { data, error } = await db().from('wallets').select('balance').eq('user_id', ownerId).maybeSingle();
  if (error) return null;
  return Number(data?.balance ?? 0);
}
