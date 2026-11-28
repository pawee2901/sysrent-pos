import 'server-only';
import { db } from '@/lib/db';
import type { Frame, Palette } from '@/lib/palette';

/** โทนสี + หัวเว็บ/ท้ายเว็บของร้าน · ยังไม่รัน 0056 = ready false (ใช้แบบเดิม) */
export async function shopDesign(shopId: string): Promise<{ ready: boolean; palette: Palette; frame: Frame }> {
  const { data, error } = await db().from('shops').select('palette, site_frame').eq('id', shopId).maybeSingle();
  if (error) return { ready: false, palette: {}, frame: {} };
  return { ready: true, palette: (data?.palette ?? {}) as Palette, frame: (data?.site_frame ?? {}) as Frame };
}
