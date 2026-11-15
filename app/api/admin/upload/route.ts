import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, requireAdmin } from '@/lib/api';
import { shrinkImage } from '@/lib/shrink-image';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** อัปรูปสินค้า / โลโก้ร้าน → bucket shop-media/<shop id>/... (ตรวจหัวไฟล์จริง ไม่เชื่อแค่ชนิดที่เบราว์เซอร์บอก) */
export async function POST(req: Request) {
  const a = await requireAdmin(['products', 'settings']);
  if ('res' in a) return a.res;
  const file = (await req.formData().catch(() => null))?.get('file');
  if (!(file instanceof Blob) || !file.size) return fail('กรุณาเลือกรูป');
  const ext = TYPES[file.type];
  if (!ext) return fail('รองรับเฉพาะ jpg, png, webp');
  if (file.size > 8 * 1024 * 1024) return fail('รูปใหญ่เกิน 8MB'); // ระบบย่อ + แปลงเป็น WebP ให้ก่อนเก็บ
  const h = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const real = h[0] === 0xff && h[1] === 0xd8 ? 'jpg' : h[0] === 0x89 && h[1] === 0x50 ? 'png' : h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50 ? 'webp' : '';
  if (real !== ext) return fail('ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ');
  // ย่อ + แปลงเป็น WebP (แบนเนอร์กว้างได้ถึง 1920) — รูปมือถือหลาย MB เหลือไม่กี่ร้อย KB
  const img = await shrinkImage(Buffer.from(await file.arrayBuffer()), 1920);
  if (!img) return fail('ไฟล์รูปเสีย หรือเปิดไม่ได้');
  const path = `${a.shop.id}/${crypto.randomUUID()}.${img.ext}`;
  const st = db().storage.from('shop-media');
  const { error } = await st.upload(path, img.buf, { contentType: img.type, cacheControl: '31536000' });
  if (error) { console.error('[upload]', error.message); return fail('อัปโหลดไม่สำเร็จ', 500); }
  return NextResponse.json({ ok: true, url: st.getPublicUrl(path).data.publicUrl });
}
