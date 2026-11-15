/* =============================================================
   จัดหน้าแรกเอง (shops.home_layout): รายการกล่องเรียงจากบนลงล่าง
   null / ยังไม่ตั้ง = หน้าแรกแบบเดิม · ใช้ได้ทั้งเซิร์ฟเวอร์และหน้าเว็บ (ไม่มีข้อมูลลับ)
   ============================================================= */

export type BlockType = 'hero' | 'promos' | 'live' | 'stats' | 'products' | 'how' | 'featured' | 'text' | 'image' | 'notice' | 'button' | 'video' | 'space';
export type Block = {
  id: string; type: BlockType; on: boolean;
  /** ครึ่งแถว (จอคอม: วางคู่กับกล่องครึ่งแถวถัดไป · มือถือ: เต็มแถวเสมอ) */
  half?: boolean;
  title?: string; text?: string; image?: string; link?: string; label?: string;
  /** สินค้าแนะนำ: ขายดี / ตามหมวด / เลือกเอง */
  pick?: 'best' | 'cat' | 'ids'; category?: string; ids?: string[]; limit?: number;
  tone?: 'accent' | 'ok' | 'warn' | 'info'; align?: 'left' | 'center'; size?: 's' | 'm' | 'l'; video?: string;
};

/** กล่องของระบบ (มีได้อย่างละ 1) */
export const BUILTIN: BlockType[] = ['hero', 'promos', 'live', 'stats', 'products', 'how'];
/** กล่องที่ตั้งเป็นครึ่งแถวได้ */
export const HALF_OK: BlockType[] = ['featured', 'text', 'image', 'notice', 'button', 'video'];
export const LAYOUT_MAX = 30;

export const BLOCK_INFO: Record<BlockType, { icon: string; label: string; desc: string }> = {
  hero: { icon: '🏠', label: 'หัวเว็บ / รูปหน้าแรก', desc: 'กล่องข้อความต้อนรับ หรือรูปหน้าแรกที่อัปไว้' },
  promos: { icon: '🎁', label: 'กล่องรูปโปร', desc: 'รูปโปรโมทที่ตั้งในแท็บ "รูปหน้าแรก · ป๊อปอัป"' },
  live: { icon: '🟢', label: 'คนเพิ่งซื้อ', desc: 'แถบโชว์ลูกค้าที่เพิ่งซื้อล่าสุด' },
  stats: { icon: '📊', label: 'ตัวเลขร้าน', desc: 'สมาชิก · ขายไปแล้ว · พร้อมส่ง' },
  products: { icon: '🛍️', label: 'สินค้าทั้งหมด', desc: 'สินค้าทุกชิ้น + ปุ่มหมวด (ช่องค้นหาใช้กล่องนี้)' },
  how: { icon: '🧭', label: 'ซื้อง่าย 3 ขั้นตอน', desc: 'อธิบายวิธีซื้อสั้น ๆ' },
  featured: { icon: '⭐', label: 'สินค้าแนะนำ', desc: 'โชว์สินค้าขายดี ตามหมวด หรือเลือกเอง' },
  text: { icon: '📝', label: 'กล่องข้อความ', desc: 'หัวข้อ + ข้อความ เช่น เกี่ยวกับร้าน เงื่อนไข' },
  image: { icon: '🖼️', label: 'รูปภาพ', desc: 'รูปเดี่ยว กดแล้วไปลิงก์ได้' },
  notice: { icon: '📢', label: 'แถบประกาศ', desc: 'ข้อความเด่นสีสะดุดตา' },
  button: { icon: '🔘', label: 'ปุ่มลิงก์', desc: 'ปุ่มใหญ่ เช่น ทักไลน์ · สมัครตัวแทน' },
  video: { icon: '🎬', label: 'วิดีโอ YouTube', desc: 'ฝังคลิปสอนใช้งาน / รีวิว' },
  space: { icon: '↕️', label: 'ช่องว่าง', desc: 'เว้นระยะระหว่างกล่อง' },
};

export const DEFAULT_LAYOUT: Block[] = BUILTIN.map((t) => ({ id: t, type: t, on: true }));

export const newBlockId = () => Math.random().toString(36).slice(2, 10);

/** ค่าเริ่มต้นของกล่องใหม่ */
export function newBlock(type: BlockType): Block {
  const id = BUILTIN.includes(type) ? type : newBlockId();
  const base: Block = { id, type, on: true };
  if (type === 'featured') return { ...base, title: 'สินค้าแนะนำ', pick: 'best', limit: 4 };
  if (type === 'text') return { ...base, title: 'เกี่ยวกับร้าน', text: '', align: 'left' };
  if (type === 'notice') return { ...base, text: '', tone: 'accent' };
  if (type === 'button') return { ...base, label: 'ทักร้านทาง LINE', link: '' };
  if (type === 'space') return { ...base, size: 'm' };
  return base;
}

/** ข้อมูลจากฐานข้อมูล → รายการกล่อง (ไม่ใช่ array / ว่าง = แบบเดิม) */
export function parseLayout(raw: unknown): Block[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_LAYOUT;
  const types = Object.keys(BLOCK_INFO);
  return (raw as Block[]).filter((b) => b && typeof b === 'object' && types.includes(b.type) && typeof b.id === 'string').slice(0, LAYOUT_MAX);
}

/** รหัสคลิป YouTube จากลิงก์ (youtu.be / youtube.com/watch / shorts / embed) */
export function youtubeId(raw: string | undefined): string | null {
  let u: URL;
  try { u = new URL((raw ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www|m)\./, '');
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? '';
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}
