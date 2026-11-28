import 'server-only';
import { db } from '@/lib/db';
import { PERIODS, PERIOD_LABEL, PERIOD_MS, type Period } from '@/lib/otp-agent';

/** ลิงก์เว็บ OTP ที่ร้านตั้งไว้ ('' = ให้ลูกค้าค้นในเว็บร้าน · ยังไม่รัน 0047 = '') */
export async function otpLink(shopId: string): Promise<string> {
  const { data, error } = await db().from('shop_otp_config').select('otp_link').eq('shop_id', shopId).maybeSingle();
  if (error) return '';
  const v = (data?.otp_link as string | null | undefined) ?? '';
  return /^https:\/\//.test(v) ? v : '';
}

/** ระบบตัวแทน (ต้องกรอกรหัสยืนยันก่อนขอ OTP) เปิดไหม · ยังไม่รัน 0049 = ปิด */
export async function otpAgent(shopId: string): Promise<boolean> {
  const { data, error } = await db().from('shop_otp_config').select('agent_mode').eq('shop_id', shopId).maybeSingle();
  return !error && data?.agent_mode === true;
}

/** จำกัดการรับรหัสของลูกค้า: กี่ครั้งต่ออีเมล ต่อ วัน / สัปดาห์ / เดือน (0 = ไม่จำกัด · ยังไม่รัน 0050 = ไม่จำกัด) */
export async function otpCustLimit(shopId: string): Promise<{ limit: number; period: Period }> {
  const { data, error } = await db().from('shop_otp_config').select('cust_limit, cust_period').eq('shop_id', shopId).maybeSingle();
  if (error || !data) return { limit: 0, period: 'day' };
  const period = (PERIODS as readonly string[]).includes(data.cust_period as string) ? data.cust_period as Period : 'day';
  return { limit: Number(data.cust_limit ?? 0), period };
}

/** อีเมลนี้รับรหัสครบโควตาแล้วไหม → ข้อความแจ้งลูกค้า หรือ null (ยังรับได้) */
export async function otpCustBlocked(shopId: string, account: string): Promise<string | null> {
  const { limit, period } = await otpCustLimit(shopId);
  if (!limit) return null;
  const { count, error } = await db().from('shop_otp_requests').select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId).eq('account', account).eq('found', true).gte('created_at', new Date(Date.now() - PERIOD_MS[period]).toISOString());
  if (error || (count ?? 0) < limit) return null;
  return `อีเมลนี้รับรหัสครบ ${limit} ครั้งต่อ${PERIOD_LABEL[period]}แล้ว กรุณาติดต่อแอดมินร้าน`;
}

/** หน้ารับ OTP แบบไม่ต้องล็อกอิน เปิดอยู่ไหม (ยังไม่รัน 0048 = ปิด) */
export async function otpPublic(shopId: string): Promise<boolean> {
  const { data, error } = await db().from('shop_otp_config').select('public_page').eq('shop_id', shopId).maybeSingle();
  return !error && data?.public_page === true;
}
