'use client';
import { api } from '@/components/Cart';

/**
 * ย่อรูปในเบราว์เซอร์ก่อนส่ง (รูปมือถือ 3–8MB → ไม่กี่ร้อย KB) แล้วอัปขึ้นร้าน
 * อัปไวขึ้นมากบนเน็ตมือถือ · เซิร์ฟเวอร์ยังย่อ / ตรวจไฟล์ซ้ำอีกชั้นตามเดิม
 * GIF (อาจเคลื่อนไหว) / รูปเล็กอยู่แล้ว / ย่อไม่ได้ = ส่งไฟล์เดิม
 */
export async function shrinkForUpload(file: File, max = 1920): Promise<Blob> {
  if (file.type === 'image/gif' || typeof createImageBitmap === 'undefined') return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 350 * 1024) { bmp.close(); return file; }
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bmp.close(); return file; }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.85));
    // Safari รุ่นเก่าไม่รองรับ webp → ได้ png กลับมา (ใหญ่) · ใช้ jpeg แทนถ้ารูปไม่มีพื้นใส
    const out = blob && blob.type === 'image/webp' ? blob : await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.88));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}

/** อัปรูป 1 ไฟล์ (ย่อก่อน) → { ok, data: { url }, error } เหมือน api() */
export async function uploadImage(file: File, max = 1920) {
  const blob = await shrinkForUpload(file, max);
  const fd = new FormData();
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop() || 'jpg';
  fd.append('file', blob, `image.${ext}`);
  return api<{ url: string }>('/api/admin/upload', fd);
}
