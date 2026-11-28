import 'server-only';
import { db } from '@/lib/db';

/** โควตาขอ OTP ต่อออเดอร์: limit จากแพ็กเกจ (0 = ไม่จำกัด) · used = ครั้งที่ได้รหัสแล้ว */
export type ItemQuota = { itemId: string; limit: number; used: number; name: string };

/** โควตาของรายการที่ซื้อ (ยังไม่รัน 0051 = ไม่จำกัดทุกรายการ) */
export async function itemQuotas(itemIds: string[]): Promise<Map<string, ItemQuota>> {
  const out = new Map<string, ItemQuota>();
  if (!itemIds.length) return out;
  const d = db();
  const { data, error } = await d.from('shop_order_items').select('id, name, shop_options(otp_limit)').in('id', itemIds);
  if (error) return out;
  const rows = (data ?? []) as unknown as { id: string; name: string; shop_options: { otp_limit: number | null } | null }[];
  const limited = rows.filter((r) => Number(r.shop_options?.otp_limit ?? 0) > 0).map((r) => r.id);
  const used = new Map<string, number>();
  if (limited.length) {
    const { data: rq } = await d.from('shop_otp_requests').select('order_item_id').in('order_item_id', limited).eq('found', true).limit(5000);
    for (const x of (rq ?? []) as { order_item_id: string }[]) used.set(x.order_item_id, (used.get(x.order_item_id) ?? 0) + 1);
  }
  for (const r of rows) out.set(r.id, { itemId: r.id, name: r.name.split(' · ')[0], limit: Number(r.shop_options?.otp_limit ?? 0), used: used.get(r.id) ?? 0 });
  return out;
}

/**
 * เลือกออเดอร์ที่จะนับสำหรับอีเมลนี้: ระบุ itemId มา = ใช้อันนั้น (ต้องอยู่ในรายการของอีเมล)
 * ไม่ระบุ = ออเดอร์ที่ยังขอได้ (ไม่จำกัดก่อน แล้วค่อยอันที่เหลือโควตา)
 * คืน { pick } หรือ { full } (ทุกออเดอร์ของอีเมลนี้ขอครบแล้ว)
 */
export async function pickItem(items: string[], itemId?: string): Promise<{ pick: ItemQuota | null; full: ItemQuota | null }> {
  const ids = itemId ? items.filter((i) => i === itemId) : items;
  if (!ids.length) return { pick: null, full: null };
  const q = await itemQuotas(ids);
  const list = ids.map((i) => q.get(i) ?? { itemId: i, limit: 0, used: 0, name: '' });
  const free = list.find((x) => !x.limit) ?? list.find((x) => x.used < x.limit);
  return free ? { pick: free, full: null } : { pick: null, full: list[0] };
}

export const fullMsg = (q: ItemQuota) => `ออเดอร์${q.name ? ` ${q.name}` : 'นี้'} ขอ OTP ครบ ${q.limit} ครั้งแล้ว ไม่สามารถขอได้อีก (ติดต่อแอดมินร้านถ้ามีปัญหา)`;
