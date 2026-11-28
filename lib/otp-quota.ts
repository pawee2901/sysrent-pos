import 'server-only';
import { db } from '@/lib/db';
import { otpCustLimit } from '@/lib/otp-link';

/** โควตาขอ OTP ต่อออเดอร์: limit จากแพ็กเกจ (0 = ไม่จำกัด) · used = ครั้งที่ได้รหัสแล้ว */
export type ItemQuota = { itemId: string; limit: number; used: number; name: string };

/** โควตาของรายการที่ซื้อ (ยังไม่รัน 0051 = ไม่จำกัดทุกรายการ) */
/** fallback = ค่าเริ่มต้นต่อออเดอร์ของร้าน (ใช้กับแพ็กเกจที่ไม่ได้ตั้งเอง · 0 = ไม่จำกัด) */
export async function itemQuotas(itemIds: string[], fallback = 0): Promise<Map<string, ItemQuota>> {
  const out = new Map<string, ItemQuota>();
  if (!itemIds.length) return out;
  const d = db();
  const { data, error } = await d.from('shop_order_items').select('id, name, shop_options(otp_limit)').in('id', itemIds);
  if (error) return out;
  const rows = (data ?? []) as unknown as { id: string; name: string; shop_options: { otp_limit: number | null } | null }[];
  const baseOf = (r: { shop_options: { otp_limit: number | null } | null }) => Number(r.shop_options?.otp_limit ?? 0) || fallback;
  const limited = rows.filter((r) => baseOf(r) > 0).map((r) => r.id);
  const used = new Map<string, number>();
  if (limited.length) {
    const { data: rq } = await d.from('shop_otp_requests').select('order_item_id').in('order_item_id', limited).eq('found', true).limit(5000);
    for (const x of (rq ?? []) as { order_item_id: string }[]) used.set(x.order_item_id, (used.get(x.order_item_id) ?? 0) + 1);
  }
  // คำขอ OTP เพิ่มที่แอดมินอนุมัติแล้ว (ยังไม่รัน 0052 = ไม่มี)
  const extra = new Map<string, number>();
  if (limited.length) {
    const { data: ex } = await d.from('shop_otp_asks').select('order_item_id, extra').in('order_item_id', limited).eq('status', 'approved');
    for (const x of (ex ?? []) as { order_item_id: string; extra: number }[]) extra.set(x.order_item_id, (extra.get(x.order_item_id) ?? 0) + Number(x.extra ?? 0));
  }
  for (const r of rows) {
    const base = baseOf(r);
    out.set(r.id, { itemId: r.id, name: r.name.split(' · ')[0], limit: base ? base + (extra.get(r.id) ?? 0) : 0, used: used.get(r.id) ?? 0 });
  }
  return out;
}

/**
 * เลือกออเดอร์ที่จะนับสำหรับอีเมลนี้: ระบุ itemId มา = ใช้อันนั้น (ต้องอยู่ในรายการของอีเมล)
 * ไม่ระบุ = ออเดอร์ที่ยังขอได้ (ไม่จำกัดก่อน แล้วค่อยอันที่เหลือโควตา)
 * คืน { pick } หรือ { full } (ทุกออเดอร์ของอีเมลนี้ขอครบแล้ว)
 */
export async function pickItem(items: string[], itemId?: string, fallback = 0): Promise<{ pick: ItemQuota | null; full: ItemQuota | null }> {
  const ids = itemId ? items.filter((i) => i === itemId) : items;
  if (!ids.length) return { pick: null, full: null };
  const q = await itemQuotas(ids, fallback);
  const list = ids.map((i) => q.get(i) ?? { itemId: i, limit: 0, used: 0, name: '' });
  const free = list.find((x) => !x.limit) ?? list.find((x) => x.used < x.limit);
  return free ? { pick: free, full: null } : { pick: null, full: list[0] };
}

export const fullMsg = (q: ItemQuota) => `ออเดอร์${q.name ? ` ${q.name}` : 'นี้'} ขอ OTP ครบ ${q.limit} ครั้งแล้ว ไม่สามารถขอได้อีก (ติดต่อแอดมินร้านถ้ามีปัญหา)`;

/** ป๊อปอัปก่อนขอ OTP: เปิดไหม + ข้อความที่ร้านเขียนเอง ('' = มาตรฐาน) · ยังไม่รัน 0052 = เปิด / มาตรฐาน */
export async function ackConfig(shopId: string): Promise<{ on: boolean; text: string }> {
  const { data, error } = await db().from('shop_otp_config').select('ack_on, ack_text').eq('shop_id', shopId).maybeSingle();
  if (error || !data) return { on: true, text: '' };
  return { on: data.ack_on !== false, text: String(data.ack_text ?? '') };
}

/** ตอบกลับ: ต้องยอมรับก่อน (409) · ครบแล้ว + ขอเพิ่มได้ (429) */
export const needAck = (x: { limit: number; used: number; name?: string; per?: string }, text: string) =>
  Response.json({ error: 'กรุณายอมรับเงื่อนไขก่อนค้นหา', need_ack: { ...x, text } }, { status: 409 });
export const fullRes = (q: ItemQuota) => Response.json({ error: fullMsg(q), can_ask: { itemId: q.itemId, name: q.name } }, { status: 429 });

/** คำขอ OTP เพิ่มล่าสุดของแต่ละรายการ (ให้ลูกค้าเห็นสถานะ + คำตอบแอดมินในหน้าประวัติ) · ยังไม่รัน 0052 = ว่าง */
export type AskStatus = { status: string; reply: string; extra: number };
export async function latestAsks(itemIds: string[]): Promise<Map<string, AskStatus>> {
  const out = new Map<string, AskStatus>();
  if (!itemIds.length) return out;
  const { data, error } = await db().from('shop_otp_asks').select('order_item_id, status, reply, extra, created_at').in('order_item_id', itemIds).order('created_at', { ascending: false }).limit(500);
  if (error) return out;
  for (const r of (data ?? []) as { order_item_id: string; status: string; reply: string; extra: number }[]) {
    if (!out.has(r.order_item_id)) out.set(r.order_item_id, { status: r.status, reply: r.reply ?? '', extra: Number(r.extra ?? 0) });
  }
  return out;
}

/** ค่าเริ่มต้นต่อออเดอร์ของร้าน (ตั้งแบบ "ต่อออเดอร์" ไว้) · ไม่ได้ตั้ง = 0 */
export async function orderFallback(shopId: string): Promise<number> {
  const c = await otpCustLimit(shopId);
  return c.period === 'order' ? c.limit : 0;
}
