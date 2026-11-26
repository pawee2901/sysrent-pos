/**
 * ธีมหน้าร้าน (ใช้ทั้งฝั่งเซิร์ฟเวอร์และหน้าตั้งค่า) — หน้าตาของแต่ละธีมอยู่ที่ app/themes.css (.store[data-style="..."])
 * premium = ต้องซื้อที่ sysrent.shop ก่อน · ตอนนี้ทุกธีมฟรี (premium: false) · action 'themes' ของเว็บหลักยังรับ key ได้ตามเดิม
 */
import { can } from '@/lib/plan';

export type Theme = { key: string; name: string; desc: string; premium: boolean; accent: string };

export const THEMES: Theme[] = [
  { key: 'modern', name: 'โมเดิร์น', desc: 'หัวเว็บพื้นเข้มไล่สี ปุ่มแคปซูล ดูทันสมัย', premium: false, accent: 'indigo' },
  { key: 'minimal', name: 'มินิมอล', desc: 'ขาวสะอาด ปุ่มดำ เรียบหรู อ่านง่าย', premium: false, accent: 'sky' },
  { key: 'cute', name: 'น่ารักพาสเทล', desc: 'โทนพาสเทล ฟอนต์กลม ปุ่มมนนูน ลายหัวใจ', premium: false, accent: 'pink' },
  { key: 'glass', name: 'ออโรร่ากระจก', desc: 'พื้นไล่สีเคลื่อนไหว กล่องกระจกฝ้าใส ดูล้ำ', premium: false, accent: 'violet' },
  { key: 'pop', name: 'ป๊อปคอมิก', desc: 'ขอบดำหนา เงาแข็ง สีสดแบบการ์ตูน กดแล้วปุ่มยุบ', premium: false, accent: 'orange' },
  { key: 'neon', name: 'นีออนราตรี', desc: 'พื้นมืด ขอบและตัวหนังสือเรืองแสงสีร้าน สไตล์เกมมิ่ง', premium: false, accent: 'violet' },
  { key: 'luxe', name: 'หรูหรา', desc: 'พื้นงาช้าง หัวข้อตัวอักษรมีเชิง มุมคม กรอบเส้นบาง', premium: false, accent: 'brown' },
  { key: 'candy', name: 'ลูกกวาดสายรุ้ง', desc: 'พาสเทลหลายสี ขอบสายรุ้ง ปุ่มเยลลี่ การ์ดสินค้าสลับสี', premium: false, accent: 'pink' },
  { key: 'kitty', name: 'เหมียวเหมียว', desc: 'โทนครีมอุ่น ลายรอยเท้าแมว การ์ดสินค้ามีหูแมว', premium: false, accent: 'orange' },
  { key: 'cloud', name: 'ปุยเมฆฟ้าใส', desc: 'ท้องฟ้าไล่สี ก้อนเมฆ การ์ดฟูนุ่มลอยได้ ปุ่มเงาวาว', premium: false, accent: 'sky' },
  { key: 'carbon', name: 'คาร์บอนสปอร์ต', desc: 'ลายคาร์บอน แถบแข่งสีร้าน ปุ่มเฉียง หัวข้อตัวหนาเอียง สายรถ', premium: false, accent: 'red' },
  { key: 'tactical', name: 'แทคติคอล', desc: 'เขียวทหาร ลายพราง มุมกรอบเล็ง ตัวหนังสือแบบป้ายสั่งการ', premium: false, accent: 'lime' },
  { key: 'steel', name: 'เหล็กอุตสาหกรรม', desc: 'แผ่นเหล็กขัด หมุดย้ำมุมการ์ด แถบเตือนเหลืองดำ', premium: false, accent: 'blue' },
  { key: 'cyber', name: 'ไซเบอร์ HUD', desc: 'กรมท่าเข้ม กล่องมุมตัดเฉียง เส้นเรืองแสงบาง แบบหน้าจอเกม', premium: false, accent: 'sky' },
  { key: 'sticker', name: 'สมุดสติกเกอร์', desc: 'กระดาษตาราง ฟอนต์ลายมือ การ์ดเอียงติดเทปกาว ไฮไลต์หัวข้อ', premium: false, accent: 'rose' },
];

export const themeOf = (key: string) => THEMES.find((t) => t.key === key);

/** ร้านใช้ธีมนี้ได้ไหม (ธีมฟรี หรือซื้อแล้ว) */
export const canUseTheme = (key: string, owned: string[]) => {
  const t = themeOf(key);
  return !!t && (!t.premium || owned.includes(key));
};

/** ธีมที่หน้าร้านใช้จริง — ธีมพิเศษที่หมดสิทธิ์ (ถูกถอน) กลับเป็นโมเดิร์น */
export const activeTheme = (key: string, owned: string[]) => (canUseTheme(key, owned) ? key : 'modern');

/** ธีมที่ร้านมีสิทธิ์: Max ได้ธีมพิเศษทุกแบบ · แพ็กเกจอื่นตามที่ซื้อ */
export const ownedThemes = (plan: string | null | undefined, owned: string[] | null | undefined) =>
  can(plan, 'premium_themes') ? THEMES.filter((t) => t.premium).map((t) => t.key) : owned ?? [];
