import { can } from '@/lib/plan';

/** หัวข้อที่ลูกค้าเลือกได้ตอนแจ้งปัญหา (ใช้ทั้งฝั่งลูกค้าและหลังบ้าน) */
export const REPORT_TOPICS = [
  'เข้าใช้งานไม่ได้ / รหัสผิด',
  'โดนเปลี่ยนรหัส / โดนเตะออก',
  'จอเต็ม / โปรไฟล์ถูกใช้',
  'ยังไม่ได้รับสินค้า',
  'อื่น ๆ',
] as const;

/** ปุ่มแจ้งปัญหา = เฉพาะร้านแพ็กเกจ Pro (฿399) */
export const canReport = (plan: string | null | undefined) => can(plan, 'report');
