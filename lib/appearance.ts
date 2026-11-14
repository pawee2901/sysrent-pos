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
  ['none', 'ไม่มี', ''], ['confetti', 'คอนเฟตติ', '🎊'], ['hearts', 'หัวใจ', '💗'], ['sakura', 'ซากุระ', '🌸'],
  ['snow', 'หิมะ', '❄️'], ['stars', 'ดาว', '✨'], ['lantern', 'โคมลอย', '🏮'], ['bubbles', 'ฟองสบู่', '🫧'],
] as const;
export const LOADERS = [['none', 'ไม่มี'], ['spinner', 'วงกลมหมุน'], ['dots', 'จุดเด้ง'], ['heart', 'หัวใจเต้น'], ['logo', 'โลโก้เด้ง'], ['bar', 'แถบวิ่ง'],
  // ฟังก์ชันเสริมจาก SysRent: ตัวการ์ตูน (code ต้องตรงกับ BUILTIN_LOADERS ใน components/addons/AddonArt.tsx — ไฟล์นั้นเป็น client component นำเข้าฝั่ง server ไม่ได้)
  ['cat', '🐱 แมวส้ม'], ['bunny', '🐰 กระต่าย'], ['penguin', '🐧 เพนกวิน'], ['dino', '🦖 ไดโนเสาร์'], ['ghost', '👻 ผีน้อย'], ['chick', '🐣 ลูกเจี๊ยบ'],
  ['bear', '🐻 หมีน้อย'], ['krathong', '🪷 กระทง'], ['sleigh', '🎅 ซานต้าขี่เลื่อน']] as const;

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
