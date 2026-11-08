/**
 * สีร้าน (shops.accent): ชื่อสีสำเร็จรูป หรือรหัสสีที่ร้านเลือกเอง (#rrggbb)
 * ใส่เป็นตัวแปร CSS บน <html> → ทุกหน้า / ทุกธีมใช้สีนี้ (--accent, --accent-2 สีคู่ไล่เฉด, --accent-soft พื้นอ่อน)
 */
export type Accent = { key: string; name: string; main: string; pair: string };

export const ACCENTS: Accent[] = [
  { key: 'indigo', name: 'คราม', main: '#5b5bd6', pair: '#a855f7' },
  { key: 'violet', name: 'ม่วง', main: '#7c3aed', pair: '#ec4899' },
  { key: 'pink', name: 'ชมพู', main: '#e64980', pair: '#f97316' },
  { key: 'rose', name: 'กุหลาบ', main: '#e11d48', pair: '#f59e0b' },
  { key: 'red', name: 'แดง', main: '#dc2626', pair: '#f97316' },
  { key: 'orange', name: 'ส้ม', main: '#ea6a12', pair: '#f43f5e' },
  { key: 'amber', name: 'เหลืองทอง', main: '#d97706', pair: '#ef4444' },
  { key: 'lime', name: 'เขียวมะนาว', main: '#65a30d', pair: '#0d9488' },
  { key: 'emerald', name: 'เขียว', main: '#0d9f6e', pair: '#06b6d4' },
  { key: 'teal', name: 'เขียวน้ำทะเล', main: '#0d9488', pair: '#3b82f6' },
  { key: 'sky', name: 'ฟ้า', main: '#0e8fd1', pair: '#6366f1' },
  { key: 'blue', name: 'น้ำเงิน', main: '#2563eb', pair: '#06b6d4' },
  { key: 'brown', name: 'น้ำตาล', main: '#a16207', pair: '#dc2626' },
  { key: 'slate', name: 'เทาเข้ม', main: '#334155', pair: '#6366f1' },
  { key: 'black', name: 'ดำ', main: '#18181b', pair: '#52525b' },
];

export const HEX = /^#[0-9a-f]{6}$/;
export const isAccent = (v: string) => HEX.test(v) || ACCENTS.some((a) => a.key === v);

/** สีหลักแบบรหัส (ใช้ในหน้าตั้งค่า / ตัวอย่าง) */
export const accentHex = (v: string) => (HEX.test(v) ? v : ACCENTS.find((a) => a.key === v)?.main ?? ACCENTS[0].main);

/** ตัวแปร CSS ของสีร้าน — ใช้ใน style={} */
export function accentVars(v: string): Record<string, string> {
  const preset = ACCENTS.find((a) => a.key === v);
  const main = preset?.main ?? (HEX.test(v) ? v : ACCENTS[0].main);
  const pair = preset?.pair ?? `color-mix(in oklab, ${main} 60%, #ec4899)`;
  return { '--accent': main, '--accent-2': pair, '--accent-soft': `color-mix(in srgb, ${main} 12%, var(--surface))` };
}
