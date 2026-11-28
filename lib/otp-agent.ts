/** ระบบตัวแทนของหน้ารับ OTP (แบบเว็บเช่า OTP) — ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และหน้าเว็บ */
export const ACCESS_KINDS = ['pin', 'username', 'email'] as const;
export type AccessKind = (typeof ACCESS_KINDS)[number];
export const ACCESS_LABEL: Record<AccessKind, string> = { pin: 'รหัส 4 หลัก', username: 'ชื่อยูส', email: 'อีเมลตัวแทน' };
export const PERIODS = ['day', 'week', 'month'] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<Period, string> = { day: 'วัน', week: 'สัปดาห์', month: 'เดือน' };
export const PERIOD_MS: Record<Period, number> = { day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 };

export type OtpAccess = { id: string; email: string; label: string; kind: AccessKind; secret: string; use_limit: number; period: Period; active: boolean; used?: number };

/** จัดรูปค่าที่กรอก (ชื่อยูส / อีเมลไม่สนตัวพิมพ์เล็ก-ใหญ่) */
export function normalizeAccess(kind: AccessKind, v: string): string {
  const s = v.trim();
  return kind === 'pin' ? s.replace(/\D/g, '') : s.toLowerCase();
}
/** ตรวจค่าที่ร้านตั้ง → ข้อความผิดพลาด หรือ null */
export function accessProblem(kind: AccessKind, v: string): string | null {
  if (kind === 'pin') return /^\d{4}$/.test(v) ? null : 'รหัสต้องเป็นตัวเลข 4 หลัก';
  if (kind === 'email') return v.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : 'อีเมลตัวแทนไม่ถูกต้อง';
  return /^[a-z0-9ก-๙_.\-]{2,40}$/.test(v) ? null : 'ชื่อยูสใช้ a-z 0-9 ภาษาไทย _ . - ยาว 2–40 ตัว (ไม่มีเว้นวรรค)';
}
