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

/** เรียก API ภายในของเว็บเช่า (กระเป๋าเงินเจ้าของร้าน: ยอด · สร้าง QR · ตรวจสลิป) ด้วยกุญแจ SHOP_INTERNAL_KEY */
export async function walletApi(body: Record<string, unknown> | FormData): Promise<{ status: number; data: Record<string, unknown> }> {
  const base = (process.env.SYSRENT_URL || 'https://sysrent.shop').replace(/\/$/, '');
  const key = process.env.SHOP_INTERNAL_KEY ?? '';
  if (key.length < 32) return { status: 503, data: { error: 'ระบบเติมเงินยังไม่ได้ตั้งค่า (SHOP_INTERNAL_KEY)' } };
  try {
    const isForm = body instanceof FormData;
    const r = await fetch(`${base}/api/internal/shop-wallet`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(30_000),
      headers: { 'x-internal-key': key, ...(isForm ? {} : { 'Content-Type': 'application/json' }) },
      body: isForm ? body : JSON.stringify(body),
    });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { status: 502, data: { error: 'เชื่อมต่อระบบเติมเงินของ SysRent ไม่ได้ กรุณาลองใหม่' } };
  }
}
