/**
 * สิทธิ์ของแอดมิน (ลูกค้ายศแอดมิน) — เจ้าของร้านเลือกให้ทีละเมนู · เจ้าของร้านเองเข้าได้ทุกเมนู
 * ใช้ทั้งเมนูหลังบ้าน (ซ่อนเมนูที่ไม่มีสิทธิ์) · หน้า (adminShop) · API (requireAdmin)
 */
export const PERMS = [
  { key: 'dashboard', label: 'ภาพรวม', desc: 'ยอดขาย · สถิติร้าน', href: '' },
  { key: 'orders', label: 'ออเดอร์', desc: 'ดูออเดอร์ · ส่งของ · คืนเงิน', href: '/orders' },
  { key: 'reports', label: 'แจ้งปัญหา', desc: 'ตอบลูกค้า · แก้ไอดีให้ลูกค้า', href: '/reports' },
  { key: 'products', label: 'สินค้า', desc: 'เพิ่ม / แก้สินค้า · ราคา · สต็อก', href: '/products' },
  { key: 'accounts', label: 'คลังบัญชี', desc: 'บัญชีหลัก · จอ (สินค้าแบบแบ่งจอ)', href: '/accounts' },
  { key: 'renewals', label: 'ต่อเมล', desc: 'ลูกค้าต่อเมล · เตือน + รับเงินทาง LINE · เชื่อม LINE OA', href: '/renewals' },
  { key: 'coupons', label: 'คูปอง', desc: 'สร้าง / ปิดคูปองส่วนลด', href: '/coupons' },
  { key: 'customers', label: 'ลูกค้า', desc: 'ปรับยอดเงิน · ระงับ · ตั้งรหัส · ตั้งยศ', href: '/customers' },
  { key: 'agents', label: 'ตัวแทน', desc: 'ตั้ง / พัก / เอาออกตัวแทน · ดูยอดซื้อ', href: '/agents' },
  { key: 'payments', label: 'การชำระเงิน', desc: 'ประวัติเติมเงิน / สลิป', href: '/payments' },
  { key: 'otp', label: 'ค้นหา OTP', desc: 'เชื่อมกล่องอีเมล · ตั้งแอปที่ค้นได้', href: '/otp' },
  { key: 'accounting', label: 'บัญชี', desc: 'รายรับ · ต้นทุน · กำไร · จดรายจ่าย', href: '/accounting' },
  { key: 'settings', label: 'ตั้งค่าร้าน', desc: 'หน้าตาร้าน · รับเงิน · แจ้งเตือน', href: '/settings' },
] as const;

export type Perm = (typeof PERMS)[number]['key'];
export const ALL_PERMS: Perm[] = PERMS.map((p) => p.key);
/** ค่าเริ่มต้นตอนตั้งแอดมินใหม่: งานหน้าร้านประจำวัน */
export const DEFAULT_STAFF_PERMS: Perm[] = ['orders', 'reports'];
export const isPerm = (k: string): k is Perm => (ALL_PERMS as string[]).includes(k);
/** สิทธิ์จากฐานข้อมูล → เฉพาะค่าที่รู้จัก */
export const cleanPerms = (v: unknown): Perm[] => (Array.isArray(v) ? v.filter((x): x is Perm => typeof x === 'string' && isPerm(x)) : []);
