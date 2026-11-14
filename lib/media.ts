import 'server-only';
import { db } from '@/lib/db';

export type Media = { usage: string; usageImages: string[]; images: string[] };
/** multi = รัน 0029 แล้ว (หลายรูป) · single = 0012 (รูปวิธีใช้รูปเดียว) · text = 0011 (ข้อความอย่างเดียว) · none = ยังไม่มี */
export type MediaLevel = 'multi' | 'single' | 'text' | 'none';
type Row = { id: string; usage?: string | null; usage_image?: string | null; usage_images?: string[] | null; images?: string[] | null };

/** วิธีใช้งาน + รูปของสินค้า · ยังไม่รัน SQL ใหม่ = อ่านเท่าที่ฐานข้อมูลมี (หน้าไม่ล่ม) */
export async function productMedia(where: { shopId: string } | { ids: string[] }): Promise<{ map: Map<string, Media>; level: MediaLevel }> {
  const map = new Map<string, Media>();
  if ('ids' in where && !where.ids.length) return { map, level: 'multi' };
  const q = async (cols: string) => {
    const b = db().from('shop_products').select(cols);
    const r = await ('shopId' in where ? b.eq('shop_id', where.shopId) : b.in('id', where.ids));
    return { data: (r.data ?? []) as unknown as Row[], error: r.error };
  };
  let level: MediaLevel = 'multi';
  let r = await q('id, usage, usage_image, usage_images, images');
  if (r.error) { level = 'single'; r = await q('id, usage, usage_image'); }
  if (r.error) { level = 'text'; r = await q('id, usage'); }
  if (r.error) return { map, level: 'none' };
  for (const row of r.data) {
    const many = (row.usage_images ?? []).filter(Boolean);
    map.set(row.id, { usage: row.usage ?? '', usageImages: many.length ? many : row.usage_image ? [row.usage_image] : [], images: (row.images ?? []).filter(Boolean) });
  }
  return { map, level };
}
