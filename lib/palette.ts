/**
 * โทนสีทั้งร้าน + หัวเว็บ / ท้ายเว็บ (ตั้งในหน้าจัดหน้าร้าน) — ใช้ได้ทั้งเซิร์ฟเวอร์และหน้าเว็บ
 * palette = ทับตัวแปรสีของธีม (ว่าง = ตามธีม) · frame = หน้าตาหัวเว็บ / ท้ายเว็บ
 */
export type Palette = { accent?: string; accent2?: string; bg?: string; surface?: string; text?: string };
export type Frame = { logo?: 'left' | 'center'; search?: boolean; footer?: string; footerLinks?: boolean; tabbar?: boolean };

import { inkOn } from '@/lib/colors';

const HEX = /^#[0-9a-f]{6}$/i;
export const okHex = (v?: string) => !!v && HEX.test(v);

/** ชุดสีสำเร็จรูป (กดทีเดียวเปลี่ยนทั้งร้าน แล้วค่อยปรับต่อเองได้) */
export const PALETTES: { key: string; name: string; p: Required<Palette> }[] = [
  { key: 'sakura', name: 'ชมพูพาสเทล', p: { accent: '#f06292', accent2: '#ba68c8', bg: '#fff5f8', surface: '#ffffff', text: '#3a2433' } },
  { key: 'mint', name: 'มินต์', p: { accent: '#10b981', accent2: '#06b6d4', bg: '#f0fdf8', surface: '#ffffff', text: '#12322a' } },
  { key: 'sky', name: 'ฟ้าใส', p: { accent: '#3b82f6', accent2: '#06b6d4', bg: '#f2f7ff', surface: '#ffffff', text: '#14233d' } },
  { key: 'cream', name: 'ครีมคาเฟ่', p: { accent: '#b07a4f', accent2: '#d9a066', bg: '#fbf6ef', surface: '#fffdf9', text: '#3b2c20' } },
  { key: 'lavender', name: 'ลาเวนเดอร์', p: { accent: '#8b5cf6', accent2: '#ec4899', bg: '#f7f4ff', surface: '#ffffff', text: '#2a2140' } },
  { key: 'sunset', name: 'พระอาทิตย์ตก', p: { accent: '#f97316', accent2: '#e11d48', bg: '#fff7f0', surface: '#ffffff', text: '#3a2214' } },
  { key: 'gold', name: 'ดำทอง', p: { accent: '#d4a017', accent2: '#f5d76e', bg: '#0f0f12', surface: '#1a1a20', text: '#f3eee0' } },
  { key: 'navy', name: 'กรมท่า', p: { accent: '#38bdf8', accent2: '#818cf8', bg: '#0b1324', surface: '#131d33', text: '#e6edf8' } },
  { key: 'neon', name: 'นีออนเกมเมอร์', p: { accent: '#a855f7', accent2: '#22d3ee', bg: '#0a0614', surface: '#160f26', text: '#efe9ff' } },
  { key: 'mono', name: 'ขาวดำมินิมอล', p: { accent: '#111111', accent2: '#555555', bg: '#f5f5f5', surface: '#ffffff', text: '#111111' } },
];

/** palette → ตัวแปร CSS (สีรองคำนวณให้: พื้นการ์ดชั้นสอง · เส้น · ตัวหนังสือจาง) */
export function paletteVars(p: Palette | null | undefined): Record<string, string> {
  if (!p) return {};
  const v: Record<string, string> = {};
  if (okHex(p.accent)) { v['--accent'] = p.accent!; v['--accent-soft'] = `color-mix(in srgb, ${p.accent} 13%, var(--surface))`; }
  if (okHex(p.accent2)) v['--accent-2'] = p.accent2!;
  // ตัวแปรที่คำนวณจากสีหลักต้องตั้งใหม่ที่นี่ด้วย (ค่าที่ :root คำนวณจากสีเดิมไปแล้ว)
  if (okHex(p.accent) || okHex(p.accent2)) {
    const a1 = okHex(p.accent) ? p.accent! : 'var(--accent)', a2 = okHex(p.accent2) ? p.accent2! : a1;
    v['--grad'] = `linear-gradient(135deg, ${a1}, ${a2})`;
    v['--glow'] = `0 10px 28px -10px color-mix(in srgb, ${a1} 70%, transparent)`;
  }
  if (okHex(p.accent)) v['--accent-ink'] = inkOn(p.accent!);
  if (okHex(p.bg)) v['--bg'] = p.bg!;
  if (okHex(p.surface)) { v['--surface'] = p.surface!; v['--surface-2'] = `color-mix(in srgb, ${p.surface} 92%, ${okHex(p.text) ? p.text : '#808080'})`; }
  if (okHex(p.text)) {
    v['--text'] = p.text!;
    v['--muted'] = `color-mix(in srgb, ${p.text} 66%, ${okHex(p.surface) ? p.surface : (okHex(p.bg) ? p.bg : '#ffffff')})`;
    v['--faint'] = `color-mix(in srgb, ${p.text} 42%, ${okHex(p.surface) ? p.surface : (okHex(p.bg) ? p.bg : '#ffffff')})`;
    v['--line'] = `color-mix(in srgb, ${p.text} 11%, ${okHex(p.surface) ? p.surface : '#ffffff'})`;
  }
  return v;
}

export const hasPalette = (p?: Palette | null) => !!p && Object.values(p).some((x) => okHex(x));
