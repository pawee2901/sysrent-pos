import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { fail, requireCustomer } from '@/lib/api';

const MISSING = 'ร้านยังไม่เปิดรูปโปรไฟล์ (ยังไม่ได้รัน SQL 0043)';
const DIR = (shop: string) => `${shop}/avatars/`;

/** path ในที่เก็บรูปจากลิงก์เดิม (เฉพาะรูปโปรไฟล์ของร้านนี้ — ลบได้อย่างปลอดภัย) */
function oldPath(url: string | null | undefined, shop: string) {
  const i = url?.indexOf(`/shop-media/${DIR(shop)}`) ?? -1;
  return i < 0 ? null : url!.slice(i + '/shop-media/'.length).split('?')[0];
}

/** POST /api/auth/avatar (form: file) — ลูกค้าตั้งรูปโปรไฟล์: ครอปจัตุรัส 256px · WebP · ตัดข้อมูลแฝงในไฟล์ */
export async function POST(req: Request) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const file = (await req.formData().catch(() => null))?.get('file');
  if (!(file instanceof Blob) || !file.size) return fail('กรุณาเลือกรูป');
  if (file.size > 8 * 1024 * 1024) return fail('รูปใหญ่เกิน 8MB');
  const d = db();
  const cur = await d.from('shop_customers').select('avatar_url').eq('id', a.me.id).eq('shop_id', a.shop.id).maybeSingle();
  if (cur.error) return fail(MISSING, 500);
  let buf: Buffer;
  try {
    buf = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate().resize(256, 256, { fit: 'cover', position: 'attention' }).webp({ quality: 82 }).toBuffer();
  } catch { return fail('ไฟล์นี้ไม่ใช่รูปภาพ หรือเปิดไม่ได้'); }
  const path = `${DIR(a.shop.id)}${a.me.id}-${crypto.randomUUID().slice(0, 8)}.webp`;
  const st = d.storage.from('shop-media');
  const up = await st.upload(path, buf, { contentType: 'image/webp', cacheControl: '31536000' });
  if (up.error) { console.error('[avatar]', up.error.message); return fail('อัปโหลดไม่สำเร็จ', 500); }
  const url = st.getPublicUrl(path).data.publicUrl;
  const { error } = await d.from('shop_customers').update({ avatar_url: url }).eq('id', a.me.id).eq('shop_id', a.shop.id);
  if (error) { await st.remove([path]); return fail(/avatar/.test(error.message) ? MISSING : 'บันทึกไม่สำเร็จ', 500); }
  const old = oldPath(cur.data?.avatar_url, a.shop.id);
  if (old) await st.remove([old]);
  return NextResponse.json({ ok: true, url });
}

/** DELETE /api/auth/avatar — เอารูปออก กลับไปใช้ตัวอักษรแรกของชื่อ */
export async function DELETE() {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const d = db();
  const cur = await d.from('shop_customers').select('avatar_url').eq('id', a.me.id).eq('shop_id', a.shop.id).maybeSingle();
  if (cur.error) return fail(MISSING, 500);
  await d.from('shop_customers').update({ avatar_url: null }).eq('id', a.me.id).eq('shop_id', a.shop.id);
  const old = oldPath(cur.data?.avatar_url, a.shop.id);
  if (old) await d.storage.from('shop-media').remove([old]);
  return NextResponse.json({ ok: true });
}
