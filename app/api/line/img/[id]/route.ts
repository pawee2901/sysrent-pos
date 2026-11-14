import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db';
import { getShop } from '@/lib/shop';

type Ctx = { params: Promise<{ id: string }> };

/** รูปที่แปลงแล้ว (ลิงก์มี ?v= ตามรูปต้นฉบับ → เปลี่ยนรูปแล้วได้ลิงก์ใหม่เอง) · เก็บไม่เกิน 500 รูป */
const done = new Map<string, Uint8Array>();
const jpeg = (b: Uint8Array) => new Response(b as BodyInit, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800, immutable' } });

/**
 * รูปสินค้าสำหรับการ์ดใน LINE — LINE แสดงได้แค่ JPEG/PNG แต่รูปร้านอาจเป็น .webp
 * → แปลงเป็น JPEG สี่เหลี่ยมจัตุรัส 640px · หาไฟล์จาก id สินค้าของร้านนี้ (ไม่รับ URL จากภายนอก)
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const shop = await getShop();
  if (!shop || !/^[0-9a-f-]{36}$/i.test(id)) return new Response('not found', { status: 404 });
  const key = `${shop.id}/${id}/${new URL(req.url).searchParams.get('v') ?? ''}`;
  const hit = done.get(key);
  if (hit) return jpeg(hit);

  const { data } = await db().from('shop_products').select('image').eq('id', id).eq('shop_id', shop.id).maybeSingle();
  const src = String(data?.image ?? '').trim();
  let input: Buffer;
  try {
    if (src.startsWith('/')) {
      const root = path.join(process.cwd(), 'public');
      const file = path.normalize(path.join(root, decodeURIComponent(src.split('?')[0])));
      if (!file.startsWith(root + path.sep)) return new Response('not found', { status: 404 });
      input = await readFile(file);
    } else if (src.startsWith('https://')) {
      const r = await fetch(src, { signal: AbortSignal.timeout(10_000) });
      if (!r.ok) return new Response('not found', { status: 404 });
      input = Buffer.from(await r.arrayBuffer());
    } else {
      return new Response('not found', { status: 404 });
    }
    const { default: sharp } = await import('sharp');
    const out = new Uint8Array(await sharp(input).resize(640, 640, { fit: 'cover' }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer());
    done.set(key, out);
    if (done.size > 500) done.delete(done.keys().next().value!);
    return jpeg(out);
  } catch (e) {
    console.error('[line-img]', (e as Error)?.message);
    return new Response('not found', { status: 404 });
  }
}
