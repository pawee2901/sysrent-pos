import map from './url-map.json';

/** ลิงก์สาธารณะไม่ตรงกับชื่อโฟลเดอร์จริง: ตารางอยู่ใน url-map.json · next.config ทำ rewrite · middleware ปิดทางตรง */
const ADMIN = process.env.NEXT_PUBLIC_ADMIN_PATH || map.adminBase;

const PAIRS: [string, string][] = [
  ...Object.entries(map.admin).map(([real, pub]): [string, string] => [`/admin${real}`, `${ADMIN}${pub}`]),
  ['/admin', ADMIN],
  ...Object.entries(map.store),
];
const longest = (i: 0 | 1) => [...PAIRS].sort((a, b) => b[i].length - a[i].length);
const BY_REAL = longest(0), BY_PUBLIC = longest(1);

function swap(url: string, table: [string, string][], from: 0 | 1): string {
  const cut = url.search(/[?#]/);
  const path = cut < 0 ? url : url.slice(0, cut), tail = cut < 0 ? '' : url.slice(cut);
  for (const row of table) {
    const a = row[from], b = row[from ? 0 : 1];
    if (path === a || path.startsWith(`${a}/`)) return b + path.slice(a.length) + tail;
  }
  return url;
}

/** path จริงในโค้ด → ลิงก์สาธารณะ (ลิงก์ภายนอก / ที่แปลงแล้ว คืนค่าเดิม) */
export const to = (real: string): string => swap(real, BY_REAL, 0);
/** ลิงก์สาธารณะ → path จริง (ไว้เทียบเมนูที่กำลังเปิด) */
export const fromPublic = (url: string): string => swap(url, BY_PUBLIC, 1);
/** หน้าเข้าสู่ระบบ แล้วกลับมาหน้าเดิม */
export const loginUrl = (next: string): string => `${to('/login')}?next=${encodeURIComponent(to(next))}`;
