import 'server-only';
import { db } from '@/lib/db';

/** ลิงก์เว็บ OTP ที่ร้านตั้งไว้ ('' = ให้ลูกค้าค้นในเว็บร้าน · ยังไม่รัน 0047 = '') */
export async function otpLink(shopId: string): Promise<string> {
  const { data, error } = await db().from('shop_otp_config').select('otp_link').eq('shop_id', shopId).maybeSingle();
  if (error) return '';
  const v = (data?.otp_link as string | null | undefined) ?? '';
  return /^https:\/\//.test(v) ? v : '';
}
