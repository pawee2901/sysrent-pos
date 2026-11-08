import { to } from '@/lib/routes';
import { redirect } from 'next/navigation';

/** เดิมเป็นหน้า "บัญชีของฉัน" — รวมเข้ากับหน้าประวัติการซื้อแล้ว (ดูรหัสได้ในรายละเอียดแต่ละออเดอร์) */
export default function My() {
  redirect(to('/orders'));
}
