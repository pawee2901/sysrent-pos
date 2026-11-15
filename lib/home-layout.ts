/* =============================================================
   จัดหน้าแรกเอง (shops.home_layout): รายการกล่องเรียงจากบนลงล่าง
   null / ยังไม่ตั้ง = หน้าแรกแบบเดิม · ใช้ได้ทั้งเซิร์ฟเวอร์และหน้าเว็บ (ไม่มีข้อมูลลับ)
   ============================================================= */

export type BlockType =
  | 'hero' | 'promos' | 'live' | 'stats' | 'products' | 'how'
  | 'featured' | 'cats' | 'text' | 'image' | 'gallery' | 'imgtext' | 'notice' | 'button' | 'contact' | 'faq'
  | 'coupon' | 'countdown' | 'video' | 'divider' | 'space';
/** รายการย่อยในกล่อง (รูปในแกลเลอรี · คำถามในถาม-ตอบ) */
export type BlockItem = { image?: string; link?: string; q?: string; a?: string };
export type Block = {
  id: string; type: BlockType; on: boolean;
  /** ครึ่งแถว (จอคอม: วางคู่กับกล่องครึ่งแถวถัดไป · มือถือ: เต็มแถวเสมอ) */
  half?: boolean;
  title?: string; text?: string; image?: string; link?: string; label?: string;
  /** สินค้าแนะนำ: ขายดี / ตามหมวด / เลือกเอง */
  pick?: 'best' | 'cat' | 'ids'; category?: string; ids?: string[]; limit?: number;
  tone?: 'accent' | 'ok' | 'warn' | 'info' | 'dark'; align?: 'left' | 'center'; size?: 's' | 'm' | 'l'; video?: string;
  items?: BlockItem[]; cols?: number; flip?: boolean; code?: string; until?: string;
};

/** กล่องของระบบ (มีได้อย่างละ 1) */
export const BUILTIN: BlockType[] = ['hero', 'promos', 'live', 'stats', 'products', 'how'];
/** กล่องที่ตั้งเป็นครึ่งแถวได้ */
export const HALF_OK: BlockType[] = ['featured', 'cats', 'text', 'image', 'gallery', 'notice', 'button', 'contact', 'faq', 'coupon', 'countdown', 'video'];
export const LAYOUT_MAX = 40;
export const ITEMS_MAX = 12;

export const BLOCK_INFO: Record<BlockType, { icon: string; label: string; desc: string }> = {
  hero: { icon: '🏠', label: 'หัวเว็บ', desc: 'ข้อความต้อนรับ / รูปหน้าแรกที่อัปไว้' },
  promos: { icon: '🎁', label: 'กล่องรูปโปร', desc: 'รูปจากแท็บ "รูปหน้าแรก · ป๊อปอัป"' },
  live: { icon: '🟢', label: 'คนเพิ่งซื้อ', desc: 'แถบลูกค้าที่เพิ่งซื้อ' },
  stats: { icon: '📊', label: 'ตัวเลขร้าน', desc: 'สมาชิก · ขายแล้ว · พร้อมส่ง' },
  products: { icon: '🛍️', label: 'สินค้าทั้งหมด', desc: 'สินค้าทุกชิ้น + ปุ่มหมวด' },
  how: { icon: '🧭', label: 'ซื้อง่าย 3 ขั้นตอน', desc: 'อธิบายวิธีซื้อ' },
  featured: { icon: '⭐', label: 'สินค้าแนะนำ', desc: 'ขายดี / ตามหมวด / เลือกเอง' },
  cats: { icon: '🗂️', label: 'ปุ่มหมวดสินค้า', desc: 'ไอคอนหมวด กดแล้วไปที่หมวดนั้น' },
  text: { icon: '📝', label: 'ข้อความ', desc: 'หัวข้อ + ข้อความ' },
  image: { icon: '🖼️', label: 'รูปภาพ', desc: 'รูปเดี่ยว ใส่ลิงก์ได้' },
  gallery: { icon: '🧩', label: 'แกลเลอรีรูป', desc: 'รูปหลายรูปเรียงเป็นตาราง' },
  imgtext: { icon: '📰', label: 'รูปคู่ข้อความ', desc: 'รูปด้านหนึ่ง ข้อความ + ปุ่มอีกด้าน' },
  notice: { icon: '📢', label: 'แถบประกาศ', desc: 'ข้อความเด่นสีสะดุดตา' },
  button: { icon: '🔘', label: 'ปุ่มลิงก์', desc: 'ปุ่มใหญ่ไปที่ไหนก็ได้' },
  contact: { icon: '💬', label: 'ติดต่อร้าน', desc: 'ปุ่ม LINE / Facebook ของร้าน' },
  faq: { icon: '❓', label: 'คำถามที่พบบ่อย', desc: 'ถาม-ตอบ กดเปิดดูคำตอบ' },
  coupon: { icon: '🎟️', label: 'โค้ดส่วนลด', desc: 'โชว์โค้ด กดคัดลอกได้' },
  countdown: { icon: '⏰', label: 'นับถอยหลัง', desc: 'นับเวลาถึงวันหมดโปร' },
  video: { icon: '🎬', label: 'วิดีโอ YouTube', desc: 'ฝังคลิปสอน / รีวิว' },
  divider: { icon: '➖', label: 'เส้นคั่น', desc: 'เส้นแบ่งส่วน' },
  space: { icon: '↕️', label: 'ช่องว่าง', desc: 'เว้นระยะ' },
};

/** หมวดในแถบเลือกกล่อง (หน้าจัดหน้าแรก) */
export const PALETTE: [string, BlockType[]][] = [
  ['สินค้า', ['featured', 'cats', 'products']],
  ['รูป · วิดีโอ', ['image', 'gallery', 'imgtext', 'video', 'hero', 'promos']],
  ['ข้อความ', ['text', 'notice', 'faq', 'button', 'contact']],
  ['โปรโมชัน', ['coupon', 'countdown']],
  ['ตกแต่ง · อื่น ๆ', ['divider', 'space', 'live', 'stats', 'how']],
];

export const DEFAULT_LAYOUT: Block[] = BUILTIN.map((t) => ({ id: t, type: t, on: true }));

export const newBlockId = () => Math.random().toString(36).slice(2, 10);

/** ค่าเริ่มต้นของกล่องใหม่ (มีตัวอย่างให้เห็นหน้าตาทันที) */
export function newBlock(type: BlockType): Block {
  const id = BUILTIN.includes(type) ? type : newBlockId();
  const base: Block = { id, type, on: true };
  switch (type) {
    case 'featured': return { ...base, title: 'สินค้าแนะนำ', pick: 'best', limit: 4 };
    case 'cats': return { ...base, title: 'เลือกตามหมวด' };
    case 'text': return { ...base, title: 'เกี่ยวกับร้าน', text: 'ร้านเปิดทุกวัน ส่งไว รับประกันตลอดอายุการใช้งาน', align: 'left' };
    case 'gallery': return { ...base, items: [], cols: 3 };
    case 'imgtext': return { ...base, title: 'ทำไมต้องซื้อกับเรา', text: 'ส่งอัตโนมัติภายในไม่กี่วินาที มีปัญหาทักร้านได้ตลอด', label: 'เลือกซื้อเลย', link: '/#cat' };
    case 'notice': return { ...base, text: '🎉 โปรพิเศษ ลด 10% ทุกแอป', tone: 'accent' };
    case 'button': return { ...base, label: 'เลือกซื้อเลย', link: '/#cat' };
    case 'contact': return { ...base, title: 'มีคำถาม? ทักร้านได้เลย' };
    case 'faq': return { ...base, title: 'คำถามที่พบบ่อย', items: [{ q: 'ซื้อแล้วได้ของเมื่อไหร่?', a: 'ระบบส่งให้อัตโนมัติทันทีหลังตรวจสลิป' }, { q: 'มีประกันไหม?', a: 'รับประกันตลอดอายุแพ็กเกจ' }] };
    case 'coupon': return { ...base, title: 'โค้ดส่วนลดสำหรับคุณ', code: 'NEW10', text: 'ใส่โค้ดตอนชำระเงิน' };
    case 'countdown': return { ...base, title: 'โปรจะหมดใน', until: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16), tone: 'dark' };
    case 'space': return { ...base, size: 'm' };
    default: return base;
  }
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
