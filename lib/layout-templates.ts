/* =============================================================
   แม่แบบหน้าร้าน: ชุดกล่องสำเร็จรูป กดใช้แล้วแก้ต่อได้ทุกกล่อง
   ใช้ได้ทั้งหน้าแรกและหน้าเพิ่มเติม (กล่องของระบบมีได้อย่างละ 1)
   ============================================================= */
import { newBlock, type Block, type BlockType } from './home-layout';

export type LayoutTemplate = { key: string; name: string; desc: string; icon: string; kind: 'home' | 'page'; build: () => Block[] };

/** กล่องใหม่ + ค่าที่แม่แบบอยากเปลี่ยน */
const B = (type: BlockType, patch: Partial<Block> = {}): Block => ({ ...newBlock(type), ...patch });
const days = (n: number) => new Date(Date.now() + n * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 16);

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    key: 'classic', name: 'มาตรฐาน', icon: '🏠', kind: 'home', desc: 'หน้าแรกแบบเดิมของระบบ เรียบง่าย ใช้ได้ทุกร้าน',
    build: () => [B('hero'), B('promos'), B('live'), B('stats'), B('products'), B('how')],
  },
  {
    key: 'premium', name: 'ร้านแอปพรีเมียม', icon: '👑', kind: 'home', desc: 'ตัวหนังสือวิ่ง · แถบความมั่นใจ · ขายดีเลื่อนข้าง · รีวิว · ถาม-ตอบ',
    build: () => [
      B('marquee', { text: '⚡ ส่งอัตโนมัติภายใน 1 นาที · 🛡️ รับประกันตลอดอายุ · 💬 แอดมินตอบไว ทุกวัน' }),
      B('hero'), B('badges'),
      B('featured', { title: '🔥 ขายดีประจำสัปดาห์', variant: 'scroll', limit: 8 }),
      B('cats'), B('products'), B('reviews'), B('faq'), B('contact'),
    ],
  },
  {
    key: 'flash', name: 'โปรแรง Flash Sale', icon: '⚡', kind: 'home', desc: 'นับถอยหลัง · แบนเนอร์ชวนซื้อ · โค้ดส่วนลด เร่งให้ลูกค้าตัดสินใจ',
    build: () => [
      B('countdown', { title: '⚡ Flash Sale จะหมดใน', until: days(2), tone: 'accent' }),
      B('cta', { title: 'ลดทุกแอป สูงสุด 50%', text: 'เฉพาะช่วงโปรนี้เท่านั้น', label: 'ช้อปเลย', link: '/#cat', tone: 'dark' }),
      B('coupon', { title: 'ใส่โค้ดลดเพิ่มอีก', code: 'FLASH10', text: 'ลด 10% ตอนชำระเงิน' }),
      B('featured', { title: 'ดีลเด็ดวันนี้', limit: 8 }),
      B('live'), B('products'),
    ],
  },
  {
    key: 'minimal', name: 'มินิมอล', icon: '◻️', kind: 'home', desc: 'ตัวอักษรเด่น พื้นที่โล่ง รายการสินค้าอ่านง่าย',
    build: () => [
      B('heading', { title: 'แอปพรีเมียม ราคาเป็นมิตร', text: 'เลือก จ่าย ได้รหัสทันที', size: 'l' }),
      B('space', { size: 's' }),
      B('featured', { title: 'แนะนำ', variant: 'list', limit: 6 }),
      B('divider'), B('products'), B('divider'),
      B('quote', { text: 'ซื้อง่าย ได้ไว ใช้ได้จริง', title: '' }),
    ],
  },
  {
    key: 'visual', name: 'เน้นรูป แบนเนอร์', icon: '🖼️', kind: 'home', desc: 'สไลด์รูปใหญ่ · กล่องรูปโปร · แกลเลอรี เหมาะกับร้านที่มีรูปสวย',
    build: () => [
      B('slider'), B('promos'),
      B('featured', { title: 'มาใหม่ / แนะนำ', limit: 4 }),
      B('gallery', { cols: 4 }),
      B('products'), B('social'),
    ],
  },
  {
    key: 'trust', name: 'เน้นความน่าเชื่อถือ', icon: '🛡️', kind: 'home', desc: 'ตัวเลขเด่น · จุดเด่นร้าน · ขั้นตอน · รีวิว เหมาะกับร้านเปิดใหม่',
    build: () => [
      B('hero'), B('numbers'), B('features'),
      B('products'),
      B('steps', { title: 'สั่งซื้อง่าย ๆ 3 ขั้นตอน', items: [{ q: 'เลือกแอปที่ชอบ', a: 'มีหลายแพ็กเกจให้เลือก' }, { q: 'สแกนจ่ายพร้อมเพย์', a: 'ระบบตรวจสลิปอัตโนมัติ' }, { q: 'ได้รหัสทันที', a: 'ดูได้ที่ประวัติการซื้อตลอดอายุ' }] }),
      B('reviews'), B('faq'),
    ],
  },
  {
    key: 'game', name: 'สายเกม โทนเข้ม', icon: '🎮', kind: 'home', desc: 'แบนเนอร์ดำ · ไอคอนหมวด · สินค้าเลื่อนข้าง ดูมีพลัง',
    build: () => [
      B('cta', { title: 'เติมเกม ซื้อไอดี ครบจบที่เดียว', text: 'ส่งไว 24 ชม. ราคาถูกกว่าใคร', label: 'เริ่มเลย', link: '/#cat', tone: 'dark' }),
      B('marquee', { text: '🎮 โปรประจำวัน · 💎 ราคาพิเศษ · ⚡ ได้ของทันที', tone: 'accent' }),
      B('cats', { title: 'เลือกหมวด' }),
      B('featured', { title: 'ยอดนิยม', variant: 'scroll', limit: 10 }),
      B('products'), B('how'),
    ],
  },
  {
    key: 'agent', name: 'ร้านขายส่ง / ตัวแทน', icon: '🤝', kind: 'home', desc: 'ตารางราคา · ชวนสมัครตัวแทน · จุดเด่น เหมาะกับร้านที่หาตัวแทน',
    build: () => [
      B('hero'),
      B('pricelist', { title: 'ราคาปลีก', text: 'ตัวแทนได้ราคาพิเศษ ทักร้านเพื่อสมัคร' }),
      B('cta', { title: 'สมัครเป็นตัวแทน รับราคาส่ง', text: 'ทำกำไรได้ทุกออเดอร์ ไม่ต้องสต็อกของ', label: 'ทักร้านสมัคร', link: '', tone: 'accent' }),
      B('features', { title: 'ทำไมต้องเป็นตัวแทนเรา', items: [{ icon: '💰', q: 'กำไรดี', a: 'ราคาส่งต่ำกว่าหน้าร้าน' }, { icon: '⚡', q: 'ส่งอัตโนมัติ', a: 'ลูกค้าได้ของทันที' }, { icon: '🛟', q: 'มีทีมดูแล', a: 'ช่วยแก้ปัญหาให้ลูกค้าคุณ' }] }),
      B('products'), B('contact'),
    ],
  },
  // ---------- หน้าเพิ่มเติม ----------
  {
    key: 'about', name: 'เกี่ยวกับเรา', icon: '🏪', kind: 'page', desc: 'เล่าเรื่องร้าน · ตัวเลข · จุดเด่น · คำพูด · โซเชียล',
    build: () => [
      B('heading', { title: 'เกี่ยวกับเรา', text: 'ร้านขายแอปพรีเมียมที่ลูกค้าไว้ใจ', size: 'l' }),
      B('imgtext', { title: 'เริ่มจากความตั้งใจเล็ก ๆ', text: 'เราอยากให้ทุกคนใช้แอปพรีเมียมได้ในราคาที่จับต้องได้ ส่งไว และมีคนดูแลจริง', label: '', link: '' }),
      B('numbers'), B('features'),
      B('quote', { text: 'ลูกค้าพอใจ คือสิ่งที่เราใส่ใจที่สุด', title: 'ทีมงานร้าน' }),
      B('social'),
    ],
  },
  {
    key: 'howto', name: 'วิธีสั่งซื้อ', icon: '🧭', kind: 'page', desc: 'ขั้นตอน · วิดีโอสอน · ถาม-ตอบ · ปุ่มไปเลือกซื้อ',
    build: () => [
      B('heading', { title: 'วิธีสั่งซื้อ', text: 'ทำตามได้ภายใน 1 นาที', size: 'l' }),
      B('steps', { title: '', items: [{ q: 'สมัคร / เข้าสู่ระบบ', a: 'ใช้ชื่อผู้ใช้และรหัสผ่าน' }, { q: 'เลือกแอปและแพ็กเกจ', a: 'กดหยิบใส่ตะกร้า หรือซื้อเลย' }, { q: 'สแกนจ่ายพร้อมเพย์', a: 'อัปสลิป ระบบตรวจให้อัตโนมัติ' }, { q: 'รับรหัส', a: 'ดูได้ที่ "ประวัติการซื้อ" ตลอดอายุ' }] }),
      B('video', { title: 'คลิปสอนสั่งซื้อ' }),
      B('faq'),
      B('button', { label: 'ไปเลือกซื้อเลย', link: '/#cat' }),
    ],
  },
  {
    key: 'promo', name: 'หน้าโปรโมชัน', icon: '🎉', kind: 'page', desc: 'นับถอยหลัง · โค้ดส่วนลด · สินค้าร่วมโปร · แบนเนอร์',
    build: () => [
      B('heading', { title: 'โปรโมชันประจำเดือน', size: 'l' }),
      B('countdown', { title: 'โปรจะหมดใน', until: days(7), tone: 'accent' }),
      B('coupon'),
      B('featured', { title: 'สินค้าร่วมโปร', limit: 8 }),
      B('cta', { title: 'อย่าพลาด! โปรมีจำนวนจำกัด', text: '', label: 'ช้อปเลย', link: '/#cat', tone: 'dark' }),
    ],
  },
  {
    key: 'reviews', name: 'รีวิวลูกค้า', icon: '⭐', kind: 'page', desc: 'ตัวเลขความพอใจ · รีวิว · แกลเลอรีรูปรีวิว · ปุ่มชวนซื้อ',
    build: () => [
      B('heading', { title: 'รีวิวจากลูกค้าจริง', size: 'l' }),
      B('numbers', { items: [{ icon: '⭐', q: '4.9/5', a: 'คะแนนเฉลี่ย' }, { icon: '👥', q: '1,000+', a: 'ลูกค้า' }, { icon: '🔁', q: '80%', a: 'กลับมาซื้อซ้ำ' }] }),
      B('reviews', { title: '' }),
      B('gallery', { cols: 3 }),
      B('cta', { title: 'พร้อมเป็นลูกค้าคนต่อไปไหม?', text: '', label: 'เลือกซื้อเลย', link: '/#cat', tone: 'accent' }),
    ],
  },
  {
    key: 'prices', name: 'ตารางราคา', icon: '🏷️', kind: 'page', desc: 'ตารางราคาทุกแอป · แถบความมั่นใจ · ถาม-ตอบ',
    build: () => [
      B('heading', { title: 'ราคาทั้งหมด', text: 'อัปเดตล่าสุด ราคาอาจเปลี่ยนตามโปรโมชัน', size: 'l' }),
      B('badges'),
      B('pricelist', { title: 'แอปดูหนัง ฟังเพลง' }),
      B('pricelist', { title: 'แอปอื่น ๆ', items: [{ q: 'รายการ', a: '฿0' }] }),
      B('faq'),
      B('button', { label: 'สั่งซื้อ', link: '/#cat' }),
    ],
  },
  {
    key: 'contact', name: 'ติดต่อเรา', icon: '📞', kind: 'page', desc: 'ปุ่ม LINE / Facebook · โซเชียล · เวลาทำการ · ถาม-ตอบ',
    build: () => [
      B('heading', { title: 'ติดต่อเรา', text: 'มีคำถามหรือปัญหา ทักมาได้เลย', size: 'l' }),
      B('contact', { title: 'แชทกับร้าน' }),
      B('text', { title: 'เวลาทำการ', text: 'ทุกวัน 09:00 – 24:00 น.\nนอกเวลาระบบยังส่งของอัตโนมัติตามปกติ', align: 'center', half: true }),
      B('social', { half: true }),
      B('faq'),
    ],
  },
  {
    key: 'terms', name: 'เงื่อนไข / การรับประกัน', icon: '📋', kind: 'page', desc: 'หัวข้อ · ข้อความเงื่อนไข · ถาม-ตอบเรื่องประกัน',
    build: () => [
      B('heading', { title: 'เงื่อนไขและการรับประกัน', size: 'l', align: 'left' }),
      B('notice', { text: 'โปรดอ่านก่อนสั่งซื้อ', tone: 'warn' }),
      B('text', { title: 'การรับประกัน', text: '• รับประกันตลอดอายุแพ็กเกจ\n• หากใช้งานไม่ได้ แจ้งร้านพร้อมเลขออเดอร์\n• ร้านจะแก้ไขหรือเปลี่ยนให้ภายใน 24 ชม.' }),
      B('text', { title: 'ไม่รับประกันกรณี', text: '• เปลี่ยนรหัสผ่าน / ข้อมูลบัญชีเอง\n• ใช้ผิดเงื่อนไขของแอป' }),
      B('faq', { title: 'คำถามเรื่องประกัน' }),
    ],
  },
];
