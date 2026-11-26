/** ตัวเลือกหน้าตาร้าน (ใช้ทั้งหน้าร้าน หลังบ้าน และ API) — ฟอนต์จาก Google Fonts ที่รองรับภาษาไทย */
export const FONTS = [
  { key: 'prompt', name: 'Prompt', family: 'Prompt', q: 'Prompt:wght@400;500;600;700' },
  { key: 'kanit', name: 'Kanit', family: 'Kanit', q: 'Kanit:wght@400;500;600;700' },
  { key: 'sarabun', name: 'Sarabun', family: 'Sarabun', q: 'Sarabun:wght@400;500;600;700' },
  { key: 'mitr', name: 'Mitr', family: 'Mitr', q: 'Mitr:wght@400;500;600;700' },
  { key: 'mali', name: 'Mali', family: 'Mali', q: 'Mali:wght@400;500;600;700' },
  { key: 'itim', name: 'Itim', family: 'Itim', q: 'Itim' },
  { key: 'chakra', name: 'Chakra Petch', family: 'Chakra Petch', q: 'Chakra+Petch:wght@400;500;600;700' },
  { key: 'anuphan', name: 'Anuphan', family: 'Anuphan', q: 'Anuphan:wght@400;500;600;700' },
  { key: 'noto', name: 'Noto Sans Thai', family: 'Noto Sans Thai', q: 'Noto+Sans+Thai:wght@400;500;600;700' },
  { key: 'jamjuree', name: 'Bai Jamjuree', family: 'Bai Jamjuree', q: 'Bai+Jamjuree:wght@400;500;600;700' },
  { key: 'k2d', name: 'K2D', family: 'K2D', q: 'K2D:wght@400;500;600;700' },
  { key: 'krub', name: 'Krub', family: 'Krub', q: 'Krub:wght@400;500;600;700' },
  { key: 'niramit', name: 'Niramit', family: 'Niramit', q: 'Niramit:wght@400;500;600;700' },
  { key: 'pridi', name: 'Pridi', family: 'Pridi', q: 'Pridi:wght@400;500;600;700' },
  { key: 'trirong', name: 'Trirong', family: 'Trirong', q: 'Trirong:wght@400;500;600;700' },
  { key: 'sriracha', name: 'Sriracha', family: 'Sriracha', q: 'Sriracha' },
  { key: 'charm', name: 'Charm', family: 'Charm', q: 'Charm:wght@400;700' },
  { key: 'fahkwang', name: 'Fahkwang', family: 'Fahkwang', q: 'Fahkwang:wght@400;500;600;700' },
] as const;

export const EFFECTS = [
  ['none', 'ไม่มี', ''],
  // น่ารัก
  ['hearts', 'หัวใจ', '💗'], ['sakura', 'ซากุระ', '🌸'], ['bubbles', 'ฟองสบู่', '🫧'], ['flowers', 'ดอกไม้', '🌼'], ['butterfly', 'ผีเสื้อ', '🦋'],
  ['balloons', 'ลูกโป่ง', '🎈'], ['sweets', 'ขนมหวาน', '🍭'], ['paws', 'อุ้งเท้าแมว', '🐾'], ['teddy', 'ตุ๊กตาหมี', '🧸'],
  // เทศกาล · ฤดู
  ['confetti', 'คอนเฟตติ', '🎊'], ['snow', 'หิมะ', '❄️'], ['stars', 'ดาว', '✨'], ['lantern', 'โคมลอย', '🏮'], ['gifts', 'กล่องของขวัญ', '🎁'],
  ['lotus', 'ดอกบัว', '🪷'], ['spooky', 'ฮาโลวีน', '🎃'], ['leaves', 'ใบไม้ร่วง', '🍁'], ['rain', 'ฝนตก', '🌧️'], ['clover', 'ใบโคลเวอร์', '🍀'],
  // ขายของ · โชคลาภ
  ['money', 'เงินปลิว', '💸'], ['coins', 'เหรียญทอง', '🪙'], ['gems', 'เพชร', '💎'], ['percent', 'ลดราคา %', '🏷️'], ['fire', 'ไฟลุก', '🔥'],
  // เท่ · เกม · ไฮเทค
  ['glitter', 'ประกายสี', '✦'], ['fireflies', 'หิ่งห้อย', '🟡'], ['embers', 'ประกายไฟ', '🟠'], ['matrix', 'โค้ดไหล', '💻'],
  ['game', 'เกมเมอร์', '🎮'], ['rocket', 'จรวด', '🚀'], ['music', 'ตัวโน้ต', '🎵'],
] as const;
/** กลุ่มของเอฟเฟกต์ลอย (หน้าตั้งค่า) */
export const EFFECT_GROUPS: [string, string[]][] = [
  ['น่ารัก', ['hearts', 'sakura', 'bubbles', 'flowers', 'butterfly', 'balloons', 'sweets', 'paws', 'teddy']],
  ['เทศกาล · ฤดู', ['confetti', 'snow', 'stars', 'lantern', 'gifts', 'lotus', 'spooky', 'leaves', 'rain', 'clover']],
  ['ขายของ · โชคลาภ', ['money', 'coins', 'gems', 'percent', 'fire']],
  ['เท่ · เกม · ไฮเทค', ['glitter', 'fireflies', 'embers', 'matrix', 'game', 'rocket', 'music']],
];
export const LOADERS = [['none', 'ไม่มี'],
  // เรียบ ๆ
  ['spinner', 'วงกลมหมุน'], ['ring2', 'วงแหวนคู่'], ['grad', 'วงไล่สี'], ['ripple', 'คลื่นวง'], ['dots', 'จุดเด้ง'], ['orbit', 'จุดโคจร'],
  ['eq', 'แท่งเพลง'], ['bar', 'แถบวิ่ง'], ['cube', 'สี่เหลี่ยมพลิก'], ['ball', 'ลูกบอลเด้ง'], ['text', 'คำว่า กำลังโหลด'],
  // โลโก้ร้าน
  ['logo', 'โลโก้เด้ง'], ['logospin', 'โลโก้หมุน'], ['logopulse', 'โลโก้ + คลื่น'],
  // อีโมจิ
  ['heart', 'หัวใจเต้น'], ['rocket', '🚀 จรวด'], ['cart', '🛒 รถเข็น'], ['gift', '🎁 ของขวัญ'], ['hourglass', '⏳ นาฬิกาทราย'], ['game', '🎮 จอยเกม'], ['money', '💸 เงิน'], ['star', '⭐ ดาวหมุน'],
  // ฟังก์ชันเสริมจาก SysRent: ตัวการ์ตูน (code ต้องตรงกับ BUILTIN_LOADERS ใน components/addons/AddonArt.tsx — ไฟล์นั้นเป็น client component นำเข้าฝั่ง server ไม่ได้)
  ['cat', '🐱 แมวส้ม'], ['bunny', '🐰 กระต่าย'], ['penguin', '🐧 เพนกวิน'], ['dino', '🦖 ไดโนเสาร์'], ['ghost', '👻 ผีน้อย'], ['chick', '🐣 ลูกเจี๊ยบ'],
  ['bear', '🐻 หมีน้อย'], ['krathong', '🪷 กระทง'], ['sleigh', '🎅 ซานต้าขี่เลื่อน']] as const;
/** กลุ่มของเอฟเฟกต์รอโหลด (หน้าตั้งค่า) */
export const LOADER_GROUPS: [string, string[]][] = [
  ['เรียบ ๆ', ['spinner', 'ring2', 'grad', 'ripple', 'dots', 'orbit', 'eq', 'bar', 'cube', 'ball', 'text']],
  ['โลโก้ร้าน', ['logo', 'logospin', 'logopulse']],
  ['อีโมจิ', ['heart', 'rocket', 'cart', 'gift', 'hourglass', 'game', 'money', 'star']],
  ['ตัวการ์ตูน', ['cat', 'bunny', 'penguin', 'dino', 'ghost', 'chick', 'bear', 'krathong', 'sleigh']],
];

/**
 * ธีมเทศกาล (ฟังก์ชันเสริมจาก SysRent): รูปฉาก + เอฟเฟกต์เคลื่อนไหว เต็มหน้าร้าน — บันทึกในคอลัมน์ effect เป็น 'fest-<code>'
 * code ต้องตรงกับ BUILTIN_THEMES ใน components/addons/AddonArt.tsx
 */
export const FESTIVALS = [
  ['christmas', 'คริสต์มาส หิมะ', '🎄'], ['xmasnight', 'คริสต์มาส คืนหิมะ', '🎅'], ['newyear', 'ปีใหม่ พลุ', '🎆'], ['loykrathong', 'ลอยกระทง', '🪷'],
  ['chinese', 'ตรุษจีน', '🧧'], ['songkran', 'สงกรานต์', '💦'], ['valentine', 'วาเลนไทน์', '💖'], ['halloween', 'ฮาโลวีน', '🎃'],
  ['sakura', 'ซากุระบาน', '🌸'], ['galaxy', 'อวกาศ กาแล็กซี', '🌌'], ['ocean', 'ใต้ทะเล', '🐠'], ['aurora', 'แสงเหนือ', '🌠'],
  ['autumn', 'ใบไม้ร่วง', '🍁'], ['firefly', 'ป่าหิ่งห้อย', '✨'], ['pastel', 'ท้องฟ้าพาสเทล', '🎈'], ['gold', 'ทองหรูหรา', '👑'], ['rain', 'ฝนพรำ เมืองยามค่ำ', '🌧️'],
] as const;
export const FEST = 'fest-';
/** 'fest-christmas' → 'christmas' · เอฟเฟกต์ลอยธรรมดา → null */
export const festOf = (effect: string) => (effect.startsWith(FEST) && FESTIVALS.some(([k]) => FEST + k === effect) ? effect.slice(FEST.length) : null);

export type Effect = (typeof EFFECTS)[number][0];
export type Loader = (typeof LOADERS)[number][0];
export const isEffect = (v: string): v is Effect => EFFECTS.some(([k]) => k === v) || festOf(v) !== null;
export const isLoader = (v: string): v is Loader => LOADERS.some(([k]) => k === v);
export const fontOf = (key: string) => FONTS.find((f) => f.key === key);
export const fontStack = (family: string) => `'${family}', 'IBM Plex Sans Thai', sans-serif`;
const gf = (q: string) => `https://fonts.googleapis.com/css2?family=${q}&display=swap`;
export const fontHref = (key: string) => { const f = fontOf(key); return f ? gf(f.q) : ''; };
/** ทุกฟอนต์ในลิงก์เดียว: ให้หน้าตั้งค่าแสดงตัวอย่างด้วยฟอนต์จริง */
export const allFontsHref = gf(FONTS.map((f) => f.q).join('&family='));
