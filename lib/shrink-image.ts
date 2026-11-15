import 'server-only';
import sharp, { type Metadata } from 'sharp';

export type Shrunk = { buf: Buffer; ext: string; type: string; before: number; after: number };

const KEEP: Record<string, [string, string]> = {
  jpeg: ['jpg', 'image/jpeg'], png: ['png', 'image/png'], webp: ['webp', 'image/webp'], gif: ['gif', 'image/gif'],
};

/**
 * ย่อรูปก่อนเก็บ: หมุนตาม EXIF · ย่อด้านยาวสุดไม่เกิน max px · แปลงเป็น WebP (พื้นใส / GIF เคลื่อนไหว ยังอยู่ครบ)
 * รูปมือถือ 3–5MB → เหลือราว 100–300KB = เว็บโหลดไว + ไม่กินโควตาส่งรูปของ Supabase
 * ถ้าแปลงแล้วไม่เล็กลง (เช่น WebP ที่ย่อมาแล้ว) ใช้ไฟล์เดิม · ไม่ใช่รูป JPG/PNG/WebP/GIF = คืน null
 * (มีไฟล์นี้ 3 ที่ — mycom / sysrantotp / pos-1 แก้ให้ตรงกันทุกที่)
 */
export async function shrinkImage(input: Buffer, max = 1600): Promise<Shrunk | null> {
  let meta: Metadata;
  try { meta = await sharp(input, { animated: true, limitInputPixels: 40_000_000 }).metadata(); } catch { return null; }
  const keep = meta.format ? KEEP[meta.format] : undefined;
  if (!keep) return null;
  const pages = meta.pages ?? 1;
  const w = meta.width ?? 0, h = (meta.pageHeight ?? meta.height ?? 0);
  const tooBig = Math.max(w, h) > max;
  let out: Buffer;
  try {
    out = await sharp(input, { animated: pages > 1, limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4, smartSubsample: true })
      .toBuffer();
  } catch { out = Buffer.alloc(0); }
  if (out.length && (tooBig || out.length < input.length * 0.95)) return { buf: out, ext: 'webp', type: 'image/webp', before: input.length, after: out.length };
  return { buf: input, ext: keep[0], type: keep[1], before: input.length, after: input.length };
}
