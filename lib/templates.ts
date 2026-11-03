/**
 * แม่แบบสินค้า: เลือกแล้วได้ชื่อ หมวด คำอธิบาย และโลโก้สำรอง (ตัวอักษรบนสีแบรนด์) — ร้านแก้ทุกอย่างได้ / อัปรูปจริงเองได้
 * ใช้ได้ทั้งหน้าร้านและหลังบ้าน
 */
export type Template = { key: string; name: string; category: string; short: string; bg: string; fg: string; description: string; fulfillment: 'stock' | 'slot' | 'manual'; plans: [string, number, number][] };

export const TEMPLATES: Template[] = [
  { key: 'netflix', name: 'Netflix Premium', category: 'ดูหนัง', short: 'N', bg: '#141414', fg: '#e50914', fulfillment: 'slot',
    description: 'ดูได้ 1 จอ ความชัด 4K HDR\nใช้โปรไฟล์ส่วนตัวพร้อม PIN\nรับประกันตลอดอายุแพ็กเกจ', plans: [['7 วัน', 39, 7], ['30 วัน', 99, 30], ['90 วัน', 279, 90]] },
  { key: 'youtube', name: 'YouTube Premium', category: 'ดูหนัง', short: '▶', bg: '#ff0033', fg: '#ffffff', fulfillment: 'manual',
    description: 'ไม่มีโฆษณา · เล่นเบื้องหลังได้\nรวม YouTube Music\nเชิญเข้าครอบครัวผ่านอีเมลของคุณ', plans: [['30 วัน', 59, 30], ['1 ปี', 590, 365]] },
  { key: 'disney', name: 'Disney+ Hotstar', category: 'ดูหนัง', short: 'D+', bg: '#0b1d5c', fg: '#ffffff', fulfillment: 'slot',
    description: 'ดูได้ 1 จอ · โปรไฟล์ส่วนตัว\nMarvel, Star Wars, Pixar ครบ', plans: [['30 วัน', 69, 30], ['90 วัน', 189, 90]] },
  { key: 'spotify', name: 'Spotify Premium', category: 'เพลง', short: 'S', bg: '#1db954', fg: '#0b0b0b', fulfillment: 'manual',
    description: 'ฟังเพลงไม่มีโฆษณา · ดาวน์โหลดฟังออฟไลน์\nใช้อีเมลของคุณเอง', plans: [['30 วัน', 49, 30], ['90 วัน', 139, 90]] },
  { key: 'chatgpt', name: 'ChatGPT Plus', category: 'ทำงาน', short: 'AI', bg: '#10a37f', fg: '#ffffff', fulfillment: 'slot',
    description: 'ใช้โมเดลล่าสุด · สร้างรูป · วิเคราะห์ไฟล์\nบัญชีแชร์ 1 ที่นั่ง', plans: [['30 วัน', 199, 30]] },
  { key: 'canva', name: 'Canva Pro', category: 'ทำงาน', short: 'C', bg: '#7d2ae8', fg: '#ffffff', fulfillment: 'manual',
    description: 'เทมเพลตพรีเมียมทั้งหมด · ลบพื้นหลัง\nใช้อีเมลของคุณเอง', plans: [['30 วัน', 39, 30], ['1 ปี', 299, 365]] },
  { key: 'viu', name: 'Viu Premium', category: 'ดูหนัง', short: 'viu', bg: '#f7c600', fg: '#111111', fulfillment: 'stock',
    description: 'ซีรีส์เกาหลีก่อนใคร · ไม่มีโฆษณา', plans: [['30 วัน', 35, 30]] },
  { key: 'prime', name: 'Prime Video', category: 'ดูหนัง', short: 'P', bg: '#00a8e1', fg: '#ffffff', fulfillment: 'slot',
    description: 'ดูได้ 1 จอ · ซีรีส์ Amazon Original', plans: [['30 วัน', 45, 30]] },
];

export const templateOf = (key: string) => TEMPLATES.find((t) => t.key === key);
export const FULFILL_LABEL: Record<string, string> = { stock: 'คลังโค้ด / บัญชี', slot: 'แบ่งจอ (คลังบัญชี)', manual: 'สั่งทำ (ร้านส่งเอง)' };
