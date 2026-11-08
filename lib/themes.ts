/**
 * ธีมหน้าร้าน (ใช้ทั้งฝั่งเซิร์ฟเวอร์และหน้าตั้งค่า) — หน้าตาของแต่ละธีมอยู่ที่ app/themes.css (.store[data-style="..."])
 * premium = ต้องซื้อที่ sysrent.shop ก่อน (SysRent ใส่ key ลง shops.themes_owned ผ่าน /api/internal/shops action 'themes')
 */
import { can } from '@/lib/plan';

export type Theme = { key: string; name: string; desc: string; premium: boolean; accent: string };

export const THEMES: Theme[] = [
  { key: 'modern', name: 'โมเดิร์น', desc: 'หัวเว็บพื้นเข้มไล่สี ปุ่มแคปซูล ดูทันสมัย', premium: false, accent: 'indigo' },
  { key: 'minimal', name: 'มินิมอล', desc: 'ขาวสะอาด ปุ่มดำ เรียบหรู อ่านง่าย', premium: false, accent: 'sky' },
  { key: 'cute', name: 'น่ารักพาสเทล', desc: 'โทนพาสเทล ฟอนต์กลม ปุ่มมนนูน ลายหัวใจ', premium: true, accent: 'pink' },
  { key: 'glass', name: 'ออโรร่ากระจก', desc: 'พื้นไล่สีเคลื่อนไหว กล่องกระจกฝ้าใส ดูล้ำ', premium: false, accent: 'violet' },
  { key: 'pop', name: 'ป๊อปคอมิก', desc: 'ขอบดำหนา เงาแข็ง สีสดแบบการ์ตูน กดแล้วปุ่มยุบ', premium: true, accent: 'orange' },
  { key: 'neon', name: 'นีออนราตรี', desc: 'พื้นมืด ขอบและตัวหนังสือเรืองแสงสีร้าน สไตล์เกมมิ่ง', premium: true, accent: 'violet' },
  { key: 'luxe', name: 'หรูหรา', desc: 'พื้นงาช้าง หัวข้อตัวอักษรมีเชิง มุมคม กรอบเส้นบาง', premium: true, accent: 'brown' },
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
