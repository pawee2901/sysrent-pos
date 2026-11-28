import { db } from '@/lib/db';

/**
 * หมวดหมู่ของร้าน (shops.categories) — แยก query จาก getShop
 * ถ้ายังไม่ได้รัน 0007 จะได้ [] (เว็บไม่พัง แค่ใช้ลำดับตามสินค้า)
 */
export async function shopCategories(shopId: string): Promise<string[]> {
  const { data, error } = await db().from('shops').select('categories').eq('id', shopId).maybeSingle();
  if (error || !data) return [];
  return (data.categories as string[] | null) ?? [];
}

/** รวมรายการหมวดของร้าน + หมวดที่สินค้าใช้อยู่แต่ยังไม่อยู่ในรายการ (เรียงตามร้านก่อน) */
export function mergeCategories(list: string[], used: string[]): string[] {
  const out = [...list];
  for (const c of used) if (c && !out.includes(c)) out.push(c);
  return out;
}

/** รูปปกหมวด (shops.category_images) — { ชื่อหมวด: url } · ยังไม่รัน 0055 = ready false */
export async function categoryImages(shopId: string): Promise<{ ready: boolean; map: Record<string, string> }> {
  const { data, error } = await db().from('shops').select('category_images').eq('id', shopId).maybeSingle();
  if (error) return { ready: false, map: {} };
  const raw = (data?.category_images ?? {}) as Record<string, unknown>;
  return { ready: true, map: Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string' && /^https:\/\//.test(v)) as [string, string][]) };
}
