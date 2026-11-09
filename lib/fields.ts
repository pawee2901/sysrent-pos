/**
 * แยกข้อความรหัสที่ส่งให้ลูกค้าเป็น "ช่อง" (หัวข้อ: ค่า) เพื่อแสดงแยก + ปุ่มคัดลอกทีละช่อง
 * รองรับ:
 *   อีเมล: a@b.com            → ช่อง อีเมล = a@b.com
 *   🔗 Link เข้าร่วมทีม: https://...  → ช่อง (ลิงก์ไม่ถูกตัดตรง https:)
 *   a@b.com | pass1234 | 2     → แบบเดิม 1 บรรทัดคั่นด้วย | (ตั้งชื่อช่องให้เอง)
 *   บรรทัดอื่น ๆ                → ข้อความธรรมดา
 */
/** ตัวอักษรล่องหนหน้าข้อความ = ร้านเลือกโหมด "ข้อความยาว" → แสดงทั้งก้อน ไม่แยกช่อง · ลบออกก่อนแสดง / คัดลอก */
const PLAIN = '⁠';
export const markPlain = (s: string) => (s.trim() ? PLAIN + s : '');
export const isPlain = (s: string) => s.includes(PLAIN);
export const stripPlain = (s: string) => s.split(PLAIN).join('');

export type DeliveredLine ={ kind: 'field'; label: string; value: string } | { kind: 'text'; text: string };

const FIELD = /^\s*([^:：\n]{1,40}?)\s*[:：]\s*(\S.*)$/;
const PIPE_NAMES = ['บัญชี / อีเมล', 'รหัสผ่าน', 'โปรไฟล์', 'PIN'];

export function parseDelivered(content: string): DeliveredLine[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const one = lines.map((l) => l.trim()).filter(Boolean);
  // แบบเดิม: บรรทัดเดียว "อีเมล | รหัส | โปรไฟล์"
  if (one.length === 1 && one[0].includes('|') && !FIELD.test(one[0])) {
    return one[0].split('|').map((v, i) => ({ kind: 'field' as const, label: PIPE_NAMES[i] ?? `ข้อมูล ${i + 1}`, value: v.trim() })).filter((f) => f.value);
  }
  return lines.map((l): DeliveredLine => {
    const m = FIELD.exec(l);
    // กันลิงก์ถูกตัด: "https://..." ทั้งบรรทัด = ไม่ใช่ช่อง
    if (m && !m[2].startsWith('//') && !/^(https?|www)$/i.test(m[1].trim())) return { kind: 'field', label: m[1].trim(), value: m[2].replace(/^[:：\s]+/, '').trim() };
    return { kind: 'text', text: l };
  });
}

/** ไอคอนตามชื่อช่อง (ถ้าชื่อมีอีโมจินำหน้าอยู่แล้ว ใช้ของเดิม) */
export function fieldIcon(label: string): string {
  if (/^\p{Extended_Pictographic}/u.test(label)) return '';
  const l = label.toLowerCase();
  if (/อีเมล|เมล|email|mail|บัญชี|user|ไอดี|id|login/.test(l)) return '👤';
  if (/รหัส|pass|pw/.test(l)) return '🔐';
  if (/โปรไฟล์|profile|จอ/.test(l)) return '🖥️';
  if (/pin|พิน/.test(l)) return '🔢';
  if (/ลิงก์|link|url/.test(l)) return '🔗';
  if (/หมด|exp|วัน/.test(l)) return '📅';
  if (/ทีม|team|แฟม|family/.test(l)) return '👥';
  return '📌';
}
