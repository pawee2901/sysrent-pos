/* =============================================================
   ช่องทางติดต่อร้าน (shops.contact_links): ใส่ได้หลายลิงก์ หลายแอป · มีชื่อปุ่ม + คำอธิบาย
   ไม่มีรายการ (ยังไม่รัน 0037 / ยังไม่ตั้ง) = ใช้ line_url / facebook_url เดิม
   ============================================================= */
import { SOCIAL, type SocialKind } from '@/lib/home-layout';

export type ContactKind = SocialKind | 'phone' | 'email' | 'shopee' | 'lazada';
export type ContactLink = { kind: ContactKind; url: string; label: string; note: string };
export const CONTACTS_MAX = 20;

export const CONTACT_KINDS: Record<ContactKind, { label: string; color: string; short: string; ph: string }> = {
  ...(Object.fromEntries((Object.keys(SOCIAL) as SocialKind[]).map((k) => [k, { ...SOCIAL[k], ph: 'https://...' }])) as Record<SocialKind, { label: string; color: string; short: string; ph: string }>),
  line: { ...SOCIAL.line, ph: 'https://lin.ee/xxxx' },
  facebook: { ...SOCIAL.facebook, ph: 'https://facebook.com/...' },
  phone: { label: 'โทร', color: '#0f766e', short: '☎', ph: '0812345678' },
  email: { label: 'อีเมล', color: '#475569', short: '✉', ph: 'shop@gmail.com' },
  shopee: { label: 'Shopee', color: '#ee4d2d', short: 'S', ph: 'https://shopee.co.th/...' },
  lazada: { label: 'Lazada', color: '#0f146d', short: 'L', ph: 'https://www.lazada.co.th/...' },
};
export const isContactKind = (k: string): k is ContactKind => k in CONTACT_KINDS;

/** ลิงก์ที่กดได้จริง: โทร = tel: · อีเมล = mailto: · อื่น ๆ = https:// */
export function contactHref(c: Pick<ContactLink, 'kind' | 'url'>): string {
  const u = c.url.trim();
  if (c.kind === 'phone') return `tel:${u.replace(/[^\d+]/g, '')}`;
  if (c.kind === 'email') return u.startsWith('mailto:') ? u : `mailto:${u}`;
  return u;
}
/** ตรวจค่าที่กรอก (ใช้ทั้งหน้าเว็บและ API) · ผ่าน = '' */
export function contactError(c: Pick<ContactLink, 'kind' | 'url'>): string {
  const u = c.url.trim();
  if (!u) return 'ใส่ลิงก์ก่อน';
  if (c.kind === 'phone') return /^\+?[\d\s-]{6,20}$/.test(u) ? '' : 'เบอร์โทรไม่ถูกต้อง';
  if (c.kind === 'email') return /^(mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u) ? '' : 'อีเมลไม่ถูกต้อง';
  return /^https:\/\/\S+$/.test(u) ? '' : 'ลิงก์ต้องขึ้นต้นด้วย https://';
}

/** ข้อมูลจากฐานข้อมูล → รายการที่ใช้ได้ */
export function parseContacts(raw: unknown): ContactLink[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<ContactLink>[]).filter((c) => c && isContactKind(String(c.kind)) && typeof c.url === 'string' && c.url.trim())
    .map((c) => ({ kind: c.kind as ContactKind, url: c.url!.trim(), label: (c.label ?? '').trim(), note: (c.note ?? '').trim() })).slice(0, CONTACTS_MAX);
}
