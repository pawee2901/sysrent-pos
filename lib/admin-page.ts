import 'server-only';
import { getShop, type Shop } from '@/lib/shop';
import { isShopAdmin } from '@/lib/auth';

/**
 * ทุกหน้าในหลังบ้านเรียกก่อนดึงข้อมูล — layout ที่ไม่แสดง children ไม่ได้หยุด page ไม่ให้ทำงาน
 * ไม่ใช่แอดมิน = null (หน้าคืนค่าว่าง ส่วน layout แสดงฟอร์มล็อกอินแทน)
 */
export async function adminShop(): Promise<Shop | null> {
  const shop = await getShop();
  if (!shop || !(await isShopAdmin())) return null;
  return shop;
}

export const thMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);
/** เที่ยงคืนเวลาไทย ย้อนหลัง n วัน (ISO) */
export function bkkMidnight(daysAgo = 0) {
  const d = new Date(Date.now() + 7 * 3_600_000);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - 7 * 3_600_000 - daysAgo * 86_400_000).toISOString();
}
export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '-');
