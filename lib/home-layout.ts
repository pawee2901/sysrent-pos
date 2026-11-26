/* =============================================================
   จัดหน้าแรกเอง (shops.home_layout): รายการกล่องเรียงจากบนลงล่าง
   null / ยังไม่ตั้ง = หน้าแรกแบบเดิม · ใช้ได้ทั้งเซิร์ฟเวอร์และหน้าเว็บ (ไม่มีข้อมูลลับ)
   ============================================================= */

export type BlockType =
  | 'hero' | 'promos' | 'live' | 'stats' | 'products' | 'how'
  | 'featured' | 'cats' | 'text' | 'image' | 'gallery' | 'imgtext' | 'notice' | 'button' | 'contact' | 'faq'
  | 'coupon' | 'countdown' | 'video' | 'divider' | 'space'
  | 'heading' | 'slider' | 'cta' | 'features' | 'steps' | 'reviews' | 'pricelist' | 'numbers' | 'marquee' | 'logos' | 'social' | 'spotlight' | 'quote' | 'linkcards' | 'badges' | 'realreviews';
/** รายการย่อยในกล่อง (รูปในแกลเลอรี · คำถามในถาม-ตอบ) */
export type BlockItem = { image?: string; link?: string; q?: string; a?: string; icon?: string; stars?: number; kind?: SocialKind };
export type SocialKind = 'line' | 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'x' | 'discord' | 'telegram' | 'web';
export const SOCIAL: Record<SocialKind, { label: string; color: string; short: string }> = {
  line: { label: 'LINE', color: '#06c755', short: 'L' }, facebook: { label: 'Facebook', color: '#1877f2', short: 'f' }, instagram: { label: 'Instagram', color: '#e1306c', short: 'IG' },
  tiktok: { label: 'TikTok', color: '#111111', short: '♪' }, youtube: { label: 'YouTube', color: '#ff0000', short: '▶' }, x: { label: 'X', color: '#000000', short: 'X' },
  discord: { label: 'Discord', color: '#5865f2', short: 'D' }, telegram: { label: 'Telegram', color: '#229ed9', short: '✈' }, web: { label: 'เว็บไซต์', color: '#64748b', short: '🌐' },
};
export type Block = {
  id: string; type: BlockType; on: boolean;
  /** ครึ่งแถว (จอคอม: วางคู่กับกล่องครึ่งแถวถัดไป · มือถือ: เต็มแถวเสมอ) */
  half?: boolean;
  title?: string; text?: string; image?: string; link?: string; label?: string;
  /** สินค้าแนะนำ: ขายดี / ตามหมวด / เลือกเอง */
  pick?: 'best' | 'cat' | 'ids'; category?: string; ids?: string[]; limit?: number;
  tone?: 'accent' | 'ok' | 'warn' | 'info' | 'dark'; align?: 'left' | 'center'; size?: 's' | 'm' | 'l'; video?: string;
  items?: BlockItem[]; cols?: number; flip?: boolean; code?: string; until?: string;
  /** สินค้าแนะนำ: ตาราง / เลื่อนข้าง / รายการ */
  variant?: 'grid' | 'scroll' | 'list' | 'bar' | 'feed' | 'ticker';
  /** ป้ายมุมขวา (การ์ดกิจกรรม: "อัปเดตสด") */
  badge?: string;
  /** รีวิวจริง: แสดงเฉพาะรีวิวที่ได้ดาวตั้งแต่เท่านี้ */
  minStars?: number;
  /** สไตล์ที่ร้านปรับเอง (ไม่ใส่ = ตามธีม) */
  style?: BlockStyle;
};

export type BlockStyle = {
  /** สีพื้นกล่อง · สีตัวอักษร · สีหลัก (ปุ่ม / ราคา / ไฮไลต์) · สีการ์ดด้านใน (#rrggbb) */
  bg?: string; fg?: string; accent?: string; card?: string;
  /** ความมนของมุม (px) · ระยะขอบด้านใน (px) */
  radius?: number; pad?: number;
  border?: 'none' | 'line' | 'accent'; shadow?: 'none' | 'soft' | 'strong';
};
export const HEX6 = /^#[0-9a-f]{6}$/i;
/** มีการปรับสไตล์อย่างน้อย 1 อย่าง */
export const hasStyle = (s?: BlockStyle) => !!s && Object.values(s).some((v) => v !== undefined && v !== '');

/** สไตล์ของกล่อง → className + ตัวแปร CSS (ใช้ทั้งหน้าร้านและหน้าจัดร้าน) */
export function blockStyle(s?: BlockStyle): { className: string; style: Record<string, string> } | null {
  if (!hasStyle(s)) return null;
  const v: Record<string, string> = {};
  const cls = ['hb-st'];
  const ok = (c?: string) => !!c && HEX6.test(c);
  if (ok(s!.bg)) { v['--hb-bg'] = s!.bg!; cls.push('st-bg'); }
  if (ok(s!.fg)) { v['--text'] = s!.fg!; v['--muted'] = `color-mix(in srgb, ${s!.fg} 68%, transparent)`; v.color = s!.fg!; }
  if (ok(s!.accent)) { v['--accent'] = s!.accent!; v['--accent-2'] = s!.accent!; v['--accent-soft'] = `color-mix(in srgb, ${s!.accent} 14%, transparent)`; v['--grad'] = s!.accent!; }
  if (ok(s!.card)) { v['--surface'] = s!.card!; v['--surface-2'] = s!.card!; }
  if (typeof s!.radius === 'number') { v['--hb-r'] = `${s!.radius}px`; cls.push('st-r'); }
  if (typeof s!.pad === 'number') { v['--hb-pad'] = `${s!.pad}px`; cls.push('st-pad'); }
  if (s!.border && s!.border !== 'none') cls.push(`st-b-${s!.border}`);
  if (s!.shadow && s!.shadow !== 'none') cls.push(`st-sh-${s!.shadow}`);
  return { className: cls.join(' '), style: v };
}

/** กล่องของระบบ (มีได้อย่างละ 1) */
export const BUILTIN: BlockType[] = ['hero', 'promos', 'live', 'stats', 'products', 'how'];
/** กล่องที่ตั้งเป็นครึ่งแถวได้ */
export const HALF_OK: BlockType[] = ['live', 'featured', 'cats', 'text', 'image', 'gallery', 'notice', 'button', 'contact', 'faq', 'coupon', 'countdown', 'video',
  'heading', 'slider', 'cta', 'features', 'steps', 'reviews', 'pricelist', 'numbers', 'logos', 'social', 'spotlight', 'quote', 'linkcards', 'badges', 'realreviews'];
export const LAYOUT_MAX = 60;
export const PAGES_MAX = 50;
/** ชื่อหน้าในลิงก์ (/s/ชื่อ) */
export const PAGE_SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const ITEMS_MAX = 12;

export const BLOCK_INFO: Record<BlockType, { icon: string; label: string; desc: string }> = {
  hero: { icon: '🏠', label: 'หัวเว็บ', desc: 'ข้อความต้อนรับ / รูปหน้าแรกที่อัปไว้' },
  promos: { icon: '🎁', label: 'กล่องรูปโปร', desc: 'รูปจากแท็บ "รูปหน้าแรก · ป๊อปอัป"' },
  live: { icon: '🟢', label: 'คนเพิ่งซื้อ', desc: 'ลูกค้าที่เพิ่งซื้อ · แถบ / การ์ดกิจกรรม / ตัวหนังสือวิ่ง' },
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
  heading: { icon: '🔠', label: 'หัวข้อใหญ่', desc: 'หัวข้อ + คำอธิบายเปิดส่วนใหม่' },
  slider: { icon: '🎞️', label: 'สไลด์รูป', desc: 'รูปเลื่อนเองอัตโนมัติ' },
  cta: { icon: '🚀', label: 'แบนเนอร์ชวนซื้อ', desc: 'พื้นสี/รูป + หัวข้อ + ปุ่มใหญ่' },
  features: { icon: '💎', label: 'จุดเด่นร้าน', desc: 'ไอคอน + หัวข้อ + คำอธิบาย' },
  steps: { icon: '🪜', label: 'ขั้นตอน', desc: 'ลำดับขั้นตอนตั้งเองได้' },
  reviews: { icon: '💬', label: 'รีวิวลูกค้า', desc: 'ชื่อ · ดาว · ข้อความรีวิว' },
  pricelist: { icon: '🏷️', label: 'ตารางราคา', desc: 'รายการ + ราคา เรียงเป็นตาราง' },
  numbers: { icon: '🔢', label: 'ตัวเลขเด่น', desc: 'ตัวเลขตั้งเอง เช่น 10,000+ ลูกค้า' },
  marquee: { icon: '📜', label: 'ตัวหนังสือวิ่ง', desc: 'ข้อความเลื่อนไปเรื่อย ๆ' },
  logos: { icon: '🏅', label: 'แถบโลโก้', desc: 'โลโก้แบรนด์ / ช่องทางจ่ายเงิน' },
  social: { icon: '📱', label: 'โซเชียล', desc: 'ปุ่ม TikTok IG YouTube ฯลฯ' },
  spotlight: { icon: '🔦', label: 'สินค้าเด่น', desc: 'สินค้าชิ้นเดียวแบบเต็มกล่อง' },
  quote: { icon: '❝', label: 'คำคม / คำพูด', desc: 'ข้อความเน้นตัวใหญ่' },
  linkcards: { icon: '🗃️', label: 'การ์ดลิงก์', desc: 'รูป + หัวข้อ กดไปหน้าอื่น' },
  badges: { icon: '✅', label: 'แถบความมั่นใจ', desc: 'ส่งไว · ปลอดภัย · มีประกัน' },
  realreviews: { icon: '🌟', label: 'รีวิวจากผู้ซื้อจริง', desc: 'ดึงรีวิว + คะแนนจริงของลูกค้าอัตโนมัติ' },
};

/** ช่องของรายการย่อยแต่ละแบบ (ป้ายชื่อ q / a ในหน้าแก้ไข) */
export type ItemField = 'image' | 'icon' | 'q' | 'a' | 'stars' | 'kind' | 'link';
export const ITEM_SPEC: Partial<Record<BlockType, { fields: ItemField[]; q?: string; a?: string; add: BlockItem; noun: string }>> = {
  gallery: { fields: ['image', 'link'], add: {}, noun: 'รูป' },
  slider: { fields: ['image', 'link'], add: {}, noun: 'รูป' },
  logos: { fields: ['image', 'link'], add: {}, noun: 'โลโก้' },
  faq: { fields: ['q', 'a'], q: 'คำถาม', a: 'คำตอบ', add: { q: '', a: '' }, noun: 'คำถาม' },
  features: { fields: ['icon', 'q', 'a'], q: 'หัวข้อ', a: 'รายละเอียด', add: { icon: '⚡', q: 'จุดเด่น', a: '' }, noun: 'จุดเด่น' },
  steps: { fields: ['q', 'a'], q: 'ขั้นตอน', a: 'รายละเอียด', add: { q: 'ขั้นตอนใหม่', a: '' }, noun: 'ขั้นตอน' },
  reviews: { fields: ['q', 'stars', 'a', 'image'], q: 'ชื่อลูกค้า', a: 'ข้อความรีวิว', add: { q: 'ลูกค้า', a: 'ดีมากครับ', stars: 5 }, noun: 'รีวิว' },
  pricelist: { fields: ['q', 'a', 'link'], q: 'รายการ', a: 'ราคา', add: { q: 'รายการใหม่', a: '฿99' }, noun: 'แถว' },
  numbers: { fields: ['icon', 'q', 'a'], q: 'ตัวเลข', a: 'คำอธิบาย', add: { icon: '⭐', q: '100+', a: 'คำอธิบาย' }, noun: 'ตัวเลข' },
  social: { fields: ['kind', 'link'], add: { kind: 'tiktok', link: '' }, noun: 'ช่องทาง' },
  linkcards: { fields: ['image', 'q', 'a', 'link'], q: 'หัวข้อ', a: 'คำอธิบาย', add: { q: 'หัวข้อ', a: '', link: '' }, noun: 'การ์ด' },
  badges: { fields: ['icon', 'q'], q: 'ข้อความ', add: { icon: '✅', q: 'ข้อความ' }, noun: 'ป้าย' },
};

/** หมวดในแถบเลือกกล่อง (หน้าจัดหน้าแรก) */
export const PALETTE: [string, BlockType[]][] = [
  ['สินค้า', ['featured', 'spotlight', 'cats', 'pricelist', 'products']],
  ['รูป · วิดีโอ', ['image', 'slider', 'gallery', 'imgtext', 'cta', 'video', 'logos', 'hero', 'promos']],
  ['ข้อความ', ['heading', 'text', 'notice', 'marquee', 'quote', 'faq', 'steps']],
  ['ความน่าเชื่อถือ', ['realreviews', 'reviews', 'features', 'numbers', 'badges']],
  ['ลิงก์ · ติดต่อ', ['button', 'linkcards', 'contact', 'social']],
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
    case 'heading': return { ...base, title: 'หัวข้อส่วนใหม่', text: 'คำอธิบายสั้น ๆ', align: 'center', size: 'm' };
    case 'slider': return { ...base, items: [] };
    case 'cta': return { ...base, title: 'สมัครวันนี้ รับส่วนลดทันที', text: 'โปรนี้มีจำนวนจำกัด', label: 'เลือกซื้อเลย', link: '/#cat', tone: 'accent' };
    case 'features': return { ...base, title: 'ทำไมต้องร้านเรา', cols: 3, items: [{ icon: '⚡', q: 'ส่งไว', a: 'ได้ของทันทีหลังจ่าย' }, { icon: '🛡️', q: 'มีประกัน', a: 'รับประกันตลอดอายุ' }, { icon: '💬', q: 'ดูแลตลอด', a: 'ทักร้านได้ทุกวัน' }] };
    case 'steps': return { ...base, title: 'วิธีสั่งซื้อ', items: [{ q: 'เลือกสินค้า', a: '' }, { q: 'ชำระเงิน', a: '' }, { q: 'รับของ', a: '' }] };
    case 'reviews': return { ...base, title: 'รีวิวจากลูกค้า', items: [{ q: 'คุณเอ', a: 'ส่งไวมาก ใช้ได้จริง', stars: 5 }, { q: 'คุณบี', a: 'แอดมินตอบไว ประทับใจ', stars: 5 }, { q: 'คุณซี', a: 'ราคาดี จะกลับมาซื้ออีก', stars: 5 }] };
    case 'pricelist': return { ...base, title: 'ราคา', items: [{ q: 'Netflix 1 เดือน', a: '฿99' }, { q: 'YouTube Premium 1 เดือน', a: '฿59' }] };
    case 'numbers': return { ...base, items: [{ icon: '👥', q: '1,000+', a: 'ลูกค้า' }, { icon: '📦', q: '5,000+', a: 'ออเดอร์' }, { icon: '⭐', q: '4.9', a: 'คะแนนรีวิว' }] };
    case 'marquee': return { ...base, text: '🔥 โปรแรง ลดทุกแอป · ส่งไวภายใน 1 นาที · รับประกันตลอดอายุ 🔥', tone: 'dark' };
    case 'logos': return { ...base, items: [] };
    case 'social': return { ...base, title: 'ติดตามเรา', items: [{ kind: 'tiktok', link: '' }, { kind: 'instagram', link: '' }] };
    case 'spotlight': return { ...base, label: 'ซื้อเลย', text: '' };
    case 'quote': return { ...base, text: 'ซื้อง่าย ได้ไว ใช้ได้จริง', title: 'ร้านของเรา', align: 'center' };
    case 'linkcards': return { ...base, title: 'ลิงก์ที่น่าสนใจ', cols: 3, items: [{ q: 'ประวัติการซื้อ', a: 'ดูไอดีที่ซื้อไว้', link: '/history' }, { q: 'เติมเงิน', a: 'เติมเข้ากระเป๋า', link: '/balance' }] };
    case 'realreviews': return { ...base, title: 'รีวิวจากผู้ซื้อจริง', limit: 6, minStars: 4 };
    case 'badges': return { ...base, items: [{ icon: '⚡', q: 'ส่งอัตโนมัติ' }, { icon: '🔒', q: 'จ่ายปลอดภัย' }, { icon: '🛡️', q: 'มีประกัน' }, { icon: '💬', q: 'ทักได้ทุกวัน' }] };
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
