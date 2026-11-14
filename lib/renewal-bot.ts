import 'server-only';
import { db } from '@/lib/db';
import { lineContent, lineDisplayName, lineLoading, pushLine, replyLine, type LineMessage, type ShopLine } from '@/lib/line';
import { LINK_CODE_RE, createRenewalPay, payBySlip, pendingPay, renewalFlex, renewSettings, type RenewalRow } from '@/lib/renewals';
import { notifyRenewal } from '@/lib/notify';
import type { Shop } from '@/lib/shop';

/**
 * บอทใน LINE OA ของร้าน — ทำแค่เรื่องต่อเมล ข้อความอื่นเงียบ (ให้ร้านตอบแชทเองตามปกติ)
 *  - พิมพ์รหัสผูก (R12345)        → ผูกรายการต่อเมลกับแชทนี้
 *  - พิมพ์ "ต่อเมล" / "ต่ออายุ"     → การ์ดรายการต่อเมลของฉัน + ปุ่มแพ็กเกจ
 *  - กดปุ่มแพ็กเกจ                 → QR พร้อมเพย์ของร้าน
 *  - ส่งรูป (มี QR รอจ่ายอยู่)       → ตรวจสลิป → ต่ออายุให้อัตโนมัติ
 * ทุกคนที่ทักมา จดชื่อไว้ (shop_line_contacts) ให้แอดมินเลือกผูกได้ในหลังบ้าน
 */
type ShopLite = Pick<Shop, 'id' | 'name' | 'slug' | 'promptpay_id' | 'receiver_name' | 'plan'>;
type LineEvent = {
  type: string; mode?: string; replyToken?: string; source?: { type: string; userId?: string };
  deliveryContext?: { isRedelivery?: boolean }; message?: { id: string; type: string; text?: string }; postback?: { data: string };
};

const KEYWORDS = new Set(['ต่อเมล', 'ต่อเมล์', 'แจ้งต่อเมล', 'แจ้งต่อเมล์', 'ต่ออายุ', 'แจ้งต่ออายุ', 'เมนู']);
const text = (t: string): LineMessage => ({ type: 'text', text: t.slice(0, 5000) });

/** จดชื่อคนที่ทักมา (ไม่เกิน 30 นาทีต่อครั้งต่อคน) */
const seen = new Map<string, number>();
async function noteContact(shopId: string, line: ShopLine, userId: string): Promise<string> {
  const key = `${shopId}:${userId}`;
  const d = db();
  if (Date.now() - (seen.get(key) ?? 0) < 30 * 60_000) {
    const { data } = await d.from('shop_line_contacts').select('display_name').eq('shop_id', shopId).eq('line_user_id', userId).maybeSingle();
    return data?.display_name ?? '';
  }
  seen.set(key, Date.now());
  if (seen.size > 50_000) seen.clear();
  const { data: cur } = await d.from('shop_line_contacts').select('display_name, last_seen').eq('shop_id', shopId).eq('line_user_id', userId).maybeSingle();
  const stale = !cur?.display_name || Date.now() - new Date(cur.last_seen).getTime() > 86_400_000;
  const name = stale ? await lineDisplayName(line.token, userId) : cur!.display_name;
  await d.from('shop_line_contacts').upsert({ shop_id: shopId, line_user_id: userId, last_seen: new Date().toISOString(), ...(name ? { display_name: name } : {}) }, { onConflict: 'shop_id,line_user_id' });
  return name;
}

async function linkCode(shop: ShopLite, userId: string, name: string, code: string): Promise<LineMessage[] | null> {
  const d = db();
  const { data } = await d.from('shop_renewals').select('*').eq('shop_id', shop.id).eq('link_code', code).maybeSingle();
  const r = data as RenewalRow | null;
  if (!r) return null;   // ไม่ใช่รหัสของร้านนี้ → เงียบ
  if (r.line_user_id && r.line_user_id !== userId) return [text('รหัสนี้ถูกผูกกับแชทอื่นไปแล้ว กรุณาติดต่อร้าน')];
  if (!r.line_user_id) {
    await d.from('shop_renewals').update({ line_user_id: userId, updated_at: new Date().toISOString() }).eq('id', r.id).is('line_user_id', null);
    await notifyRenewal(shop, '🔗 ลูกค้าผูกแชทต่อเมลแล้ว', [name || 'ลูกค้า LINE', `เมลลูกค้า: ${r.customer_email}`, ...(r.fam_email ? [`fam: ${r.fam_email}`] : [])], 0x06c755);
  }
  const st = await renewSettings(shop.id);
  return [
    text(`✅ ผูกรายการต่อเมลเรียบร้อย\nก่อนหมดอายุ ${st.remindDays} วัน ร้านจะแจ้งในแชทนี้ แล้วกดจ่ายต่อได้เลย\nพิมพ์ "ต่อเมล" เพื่อดูหรือต่อล่วงหน้าได้ทุกเมื่อ`),
    await renewalFlex({ ...r, line_user_id: userId }, '🔁 รายการต่อเมลของคุณ'),
  ];
}

async function myRenewals(shop: ShopLite, userId: string): Promise<LineMessage[]> {
  const { data } = await db().from('shop_renewals').select('*').eq('shop_id', shop.id).eq('line_user_id', userId).eq('status', 'active').order('expires_on').limit(10);
  const list = (data ?? []) as RenewalRow[];
  if (!list.length) return [text('ยังไม่มีรายการต่อเมลที่ผูกกับแชทนี้\nถ้าร้านให้รหัส (เช่น R12345) พิมพ์รหัสในแชทนี้ได้เลย')];
  const cards = await Promise.all(list.map(async (r) => (await renewalFlex(r, '🔁 ต่อเมล')).contents as LineMessage));
  return [{ type: 'flex', altText: 'รายการต่อเมลของฉัน', contents: cards.length === 1 ? cards[0] : { type: 'carousel', contents: cards.slice(0, 12) } }];
}

async function handle(shop: ShopLite, line: ShopLine, e: LineEvent) {
  if (e.mode === 'standby' || e.deliveryContext?.isRedelivery) return;
  const userId = e.source?.type === 'user' ? e.source.userId : undefined;   // ไม่ตอบในกลุ่ม
  if (!userId) return;
  const name = await noteContact(shop.id, line, userId).catch(() => '');
  if (!e.replyToken) return;

  let msgs: LineMessage[] | null = null;
  if (e.type === 'message' && e.message?.type === 'text') {
    const raw = (e.message.text ?? '').trim();
    if (LINK_CODE_RE.test(raw)) msgs = await linkCode(shop, userId, name, raw.toUpperCase());
    else if (KEYWORDS.has(raw)) msgs = await myRenewals(shop, userId);
  } else if (e.type === 'postback' && e.postback) {
    const q = new URLSearchParams(e.postback.data);
    if (q.get('a') === 'rn') {
      void lineLoading(line.token, userId, 10);
      const r = await createRenewalPay(shop, userId, q.get('r') ?? '', q.get('o') ?? '');
      msgs = r.ok ? r.messages : [text(`❌ ${r.error}`)];
    }
  } else if (e.type === 'message' && e.message?.type === 'image') {
    const pay = await pendingPay(shop.id, userId);
    if (pay) {   // ไม่มี QR รอจ่าย = รูปทั่วไปที่ส่งให้ร้านดู → เงียบ
      void lineLoading(line.token, userId, 30);
      const file = await lineContent(line.token, e.message.id);
      msgs = [text(file ? await payBySlip(shop, pay, file, name || 'ลูกค้า LINE') : 'โหลดรูปสลิปไม่สำเร็จ กรุณาส่งใหม่อีกครั้ง')];
    }
  }
  if (!msgs?.length) return;
  // ตอบไม่ทัน (ตรวจสลิปนาน token หมดอายุ) → ส่งแบบ push แทน
  if (!(await replyLine(line.token, e.replyToken, msgs))) await pushLine(line.token, userId, msgs);
}

export async function handleShopLineEvents(shop: ShopLite, line: ShopLine, events: LineEvent[]) {
  for (const e of events.slice(0, 50)) {
    await handle(shop, line, e).catch((err) => console.error('[renewal-bot]', shop.id, e.type, err));
  }
}
