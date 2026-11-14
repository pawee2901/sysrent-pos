import 'server-only';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { pushLine, shopLine, signLink, type LineMessage } from '@/lib/line';
import { notifyRenewal } from '@/lib/notify';
import { slipServiceConfigured, verifySlip } from '@/lib/slip-service';
import { receiverIsShop } from '@/lib/slip-receiver';
import type { Shop } from '@/lib/shop';

/**
 * ต่อเมลอัตโนมัติผ่าน LINE OA ของร้าน (migration 0028 · แพ็กเกจ Pro / Max)
 * แอดมินกรอกลูกค้า → ก่อนหมด N วัน ส่ง LINE เตือน + ปุ่มแพ็กเกจ → ลูกค้าจ่ายในแชท → shop_renewal_paid เลื่อนวันหมดอายุ
 */

export type RenewalRow = {
  id: string; shop_id: string; customer_email: string; fam_email: string; option_id: string | null; line_user_id: string | null;
  link_code: string; expires_on: string; note: string; status: string; removed_at: string | null;
  reminded_for: string | null; lapsed_for: string | null; renewed_count: number;
};
export type RenewSettings = { remindDays: number; graceDays: number; lateFee: number; removedFee: number; famSize: number };
export type Choice = { id: string; product: string; name: string; price: number; days: number; current: boolean };
type ShopLite = Pick<Shop, 'id' | 'name' | 'slug' | 'promptpay_id' | 'receiver_name' | 'plan'>;

const ACCENT = '#6366f1';
const MUTED = '#8a8a8a';
const RED = '#d14343';
const PAY_TTL_MS = 10 * 60_000;      // QR ใช้ได้ 10 นาที
const SLIP_GRACE_MS = 10 * 60_000;   // ส่งสลิปได้อีก 10 นาทีหลัง QR หมด
const MAX_ATTEMPTS = 5;
const SKEW = 60_000;

export const renewAllowed = (plan: string | null | undefined) => can(plan, 'renewals');

// ---------- วันที่ (เวลาไทย) ----------
export const bkkDay = (offset = 0) => new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const daysLeft = (d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${bkkDay()}T00:00:00Z`)) / 86_400_000);
export const dayTh = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });
const dayShort = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' });
const baht = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

/** รหัสผูกแชท เช่น R48213 */
export const newLinkCode = () => 'R' + String(Math.floor(10000 + Math.random() * 90000));
export const LINK_CODE_RE = /^R\d{5}$/i;

// ---------- ตั้งค่า + ค่าธรรมเนียม ----------
export async function renewSettings(shopId: string): Promise<RenewSettings> {
  const { data } = await db().from('shops').select('renew_remind_days, renew_grace_days, renew_late_fee, renew_removed_fee, renew_fam_size').eq('id', shopId).maybeSingle();
  return {
    remindDays: data?.renew_remind_days ?? 3, graceDays: data?.renew_grace_days ?? 3,
    lateFee: Number(data?.renew_late_fee ?? 10), removedFee: Number(data?.renew_removed_fee ?? 20), famSize: data?.renew_fam_size ?? 5,
  };
}
/** วันสุดท้ายที่ต่อราคาปกติ = วันหมด + grace (หมด 17 → ต่อได้ถึง 20) */
export const deadlineOf = (r: Pick<RenewalRow, 'expires_on'>, st: RenewSettings) => addDays(r.expires_on, st.graceDays);
export function feeOf(r: Pick<RenewalRow, 'expires_on' | 'removed_at'>, st: RenewSettings) {
  if (r.removed_at) return { fee: st.removedFee, why: 'ต่อหลังลบเมล' };
  if (bkkDay() > deadlineOf(r, st)) return { fee: st.lateFee, why: 'ต่อช้า' };
  return { fee: 0, why: '' };
}

/** สินค้าแบบ "ต่อเมล" (ไม่ใช่ "ไม่ต่อ") */
export const isRenewProduct = (name: string) => /ต่อ\s*เม/.test(name) && !/ไม่\s*ต่อ/.test(name);

/** แพ็กเกจที่ลูกค้าเลือกต่อได้: แพ็กเกจเดิม + แพ็กเกจของสินค้า "ต่อเมล" อื่นในร้าน (สูงสุด 4 ปุ่ม) */
export async function renewalChoices(shopId: string, optionId: string | null): Promise<Choice[]> {
  const { data } = await db().from('shop_products').select('name, active, shop_options(id, name, price, duration_days, active, sort)').eq('shop_id', shopId).eq('active', true);
  type P = { name: string; shop_options: { id: string; name: string; price: number; duration_days: number | null; active: boolean; sort: number }[] };
  const all = ((data ?? []) as P[]).flatMap((p) => p.shop_options.filter((o) => o.active).sort((a, b) => a.sort - b.sort).map((o) => ({
    id: o.id, product: p.name, name: o.name, price: Number(o.price), days: o.duration_days ?? 30, current: o.id === optionId, renew: isRenewProduct(p.name),
  })));
  const cur = all.find((c) => c.current);
  const others = all.filter((c) => c.renew && !c.current);
  return [...(cur ? [cur] : []), ...others].slice(0, 4).map(({ renew: _r, ...c }) => c);
}

const shortName = (c: Choice) => {
  const detail = (c.product.match(/\(([^)]*)\)/)?.[1] ?? '').replace(/^ต่อ\s*เมล์?\s*/, '').trim();
  return [detail || c.product.replace(/\s*[(<].*$/, '').trim(), c.name !== 'แพ็กเกจเดียว' ? c.name : ''].filter(Boolean).join(' · ');
};

/** การ์ดเตือนต่ออายุ (ส่งเตือนเอง / ลูกค้าพิมพ์ "ต่อเมล") */
export function renewalCard(r: RenewalRow, choices: Choice[], st: RenewSettings, title?: string): LineMessage {
  const left = daysLeft(r.expires_on);
  const when = left > 0 ? `หมดอายุ ${dayTh(r.expires_on)} (อีก ${left} วัน)` : left === 0 ? `หมดอายุวันนี้ (${dayTh(r.expires_on)})` : `หมดอายุแล้วเมื่อ ${dayTh(r.expires_on)}`;
  const product = choices.find((c) => c.current)?.product.replace(/\s*[(<].*$/, '') || 'บริการ';
  const { fee, why } = feeOf(r, st);
  const line = (s: string, o: Record<string, unknown> = {}) => ({ type: 'text', text: s, size: 'sm', wrap: true, ...o });
  const terms = r.removed_at
    ? [line(`เมลถูกลบออกจาก fam แล้ว ต่อตอนนี้ +${st.removedFee} บาท (ร้านเพิ่มเมลกลับให้)`, { color: RED, weight: 'bold' })]
    : fee > 0
      ? [line(`เลยกำหนดต่อ (${dayShort(deadlineOf(r, st))}) แล้ว ต่อตอนนี้ +${st.lateFee} บาท`, { color: RED, weight: 'bold' }),
        line(`หากแจ้งหลังจากลบเมลแล้ว +${st.removedFee} บาท`, { size: 'xs', color: MUTED })]
      : [line(`แจ้งต่อภายใน ${dayShort(deadlineOf(r, st))} นี้นะคะ`, { weight: 'bold', color: ACCENT }),
        ...(st.lateFee > 0 ? [line(`หากแจ้งต่อหลังจากนี้ +${st.lateFee} บาท`, { size: 'xs', color: MUTED })] : []),
        ...(st.removedFee > 0 ? [line(`แจ้งหลังจากลบเมลแล้ว +${st.removedFee} บาท`, { size: 'xs', color: MUTED })] : [])];
  const buttons = choices.length ? choices.map((c) => ({
    type: 'button', height: 'sm', style: c.current ? 'primary' : 'secondary', ...(c.current ? { color: ACCENT } : {}),
    action: {
      type: 'postback', label: `${c.current ? 'ต่อแพ็กเดิม' : 'เปลี่ยนเป็น'} ${shortName(c)} ${baht(c.price + fee)}`.slice(0, 40),
      data: `a=rn&r=${r.id}&o=${c.id}`, displayText: `ต่ออายุ ${shortName(c)} ${baht(c.price + fee)}${fee ? ` (รวม${why} ${fee} บาท)` : ''}`,
    },
  })) : [{ type: 'text', text: 'ติดต่อร้านเพื่อต่ออายุ', size: 'sm', color: MUTED, align: 'center' }];
  return {
    type: 'bubble', size: 'mega',
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
      { type: 'text', text: title ?? (left < 0 ? `⌛ ${product} หมดอายุแล้ว` : `⏰ ${product} ใกล้หมดอายุ`), weight: 'bold', size: 'lg', wrap: true },
      ...(r.fam_email ? [line(`fam: ${r.fam_email}`)] : []),
      line(`เมล: ${r.customer_email}`),
      line(when, { color: left <= st.remindDays ? RED : MUTED }),
      { type: 'separator', margin: 'md' },
      { type: 'box', layout: 'vertical', spacing: 'xs', margin: 'md', contents: terms },
    ] },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons },
  };
}

export async function renewalFlex(r: RenewalRow, title?: string): Promise<LineMessage> {
  const [choices, st] = await Promise.all([renewalChoices(r.shop_id, r.option_id), renewSettings(r.shop_id)]);
  return { type: 'flex', altText: `ต่ออายุ ${r.customer_email} ภายใน ${dayShort(deadlineOf(r, st))}`, contents: renewalCard(r, choices, st, title) };
}

// ---------- จ่ายในแชท ----------
const shopUrl = (slug: string) => `https://${slug}.${process.env.SHOP_ROOT_DOMAIN || 'sysrent.shop'}`;

/** ลูกค้ากดปุ่มแพ็กเกจ → สร้าง QR ยอด = ราคาแพ็กเกจ + ค่าธรรมเนียม (คิดที่เซิร์ฟเวอร์ ลูกค้าแก้ไม่ได้) */
export async function createRenewalPay(shop: ShopLite, lineUserId: string, renewalId: string, optionId: string): Promise<{ ok: true; messages: LineMessage[] } | { ok: false; error: string }> {
  if (!shop.promptpay_id) return { ok: false, error: 'ร้านยังไม่ได้ตั้งพร้อมเพย์ กรุณาติดต่อร้าน' };
  const d = db();
  const { data: rr } = await d.from('shop_renewals').select('*').eq('id', renewalId).eq('shop_id', shop.id).eq('line_user_id', lineUserId).maybeSingle();
  const r = rr as RenewalRow | null;
  if (!r || r.status !== 'active') return { ok: false, error: 'ไม่พบรายการต่ออายุนี้ กรุณาติดต่อร้าน' };
  const [choices, st] = await Promise.all([renewalChoices(shop.id, r.option_id), renewSettings(shop.id)]);
  const c = choices.find((x) => x.id === optionId);
  if (!c) return { ok: false, error: 'แพ็กเกจนี้ใช้ต่อไม่ได้แล้ว กรุณาพิมพ์ "ต่อเมล" แล้วเลือกใหม่' };
  // กันกดรัว: QR ต่ออายุไม่เกิน 10 ใบ / ชั่วโมง / คน
  const { count } = await d.from('shop_renewal_pays').select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id).eq('line_user_id', lineUserId).gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= 10) return { ok: false, error: 'สร้าง QR บ่อยเกินไป กรุณาลองใหม่ภายหลัง' };

  const { fee } = feeOf(r, st);
  const amount = Math.round((c.price + fee) * 100) / 100;
  const label = `${c.product} · ${c.name}`;
  const { data: p, error } = await d.from('shop_renewal_pays').insert({
    shop_id: shop.id, renewal_id: r.id, option_id: c.id, line_user_id: lineUserId, label, amount, fee, readd: Boolean(r.removed_at),
    expires_at: new Date(Date.now() + PAY_TTL_MS).toISOString(),
  }).select('id, expires_at').single();
  if (error || !p) { console.error('[renewals] pay insert', error?.message); return { ok: false, error: 'สร้าง QR ไม่สำเร็จ กรุณาลองใหม่' }; }

  const qr = `${shopUrl(shop.slug)}/api/line/qr/${p.id}?t=${signLink(p.id)}`;
  return { ok: true, messages: [
    { type: 'flex', altText: `ต่ออายุ ${r.customer_email} · ยอดชำระ ${baht(amount)}`, contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'text', text: '🧾 ต่ออายุ', weight: 'bold', size: 'lg' },
        { type: 'text', text: label, size: 'sm', wrap: true },
        { type: 'text', text: `เมล: ${r.customer_email}`, size: 'sm', wrap: true, color: MUTED },
        ...(fee ? [{ type: 'text', text: `รวม${r.removed_at ? 'ค่าต่อหลังลบเมล' : 'ค่าต่อช้า'} ${baht(fee)}`, size: 'xs', color: RED }] : []),
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'horizontal', margin: 'md', contents: [
          { type: 'text', text: 'ยอดชำระ', weight: 'bold' },
          { type: 'text', text: baht(amount), weight: 'bold', align: 'end', color: ACCENT },
        ] },
        { type: 'text', text: `สแกนจ่ายภายใน ${hhmm(p.expires_at)} น.`, size: 'xs', color: MUTED },
      ] },
    } },
    { type: 'image', originalContentUrl: qr, previewImageUrl: qr },
    { type: 'text', text: `สแกน QR พร้อมเพย์ด้านบน ยอด ${baht(amount)}\nโอนแล้วส่ง "รูปสลิป" ในแชทนี้ได้เลย ระบบตรวจและต่ออายุให้อัตโนมัติ` },
  ] };
}

/** รายการ QR ที่รอสลิปของลูกค้าคนนี้ (ล่าสุด · ยังไม่เกินเวลาตรวจ) */
export async function pendingPay(shopId: string, lineUserId: string) {
  const { data } = await db().from('shop_renewal_pays').select('*').eq('shop_id', shopId).eq('line_user_id', lineUserId).eq('status', 'pending')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  if (Date.now() > new Date(data.expires_at).getTime() + SLIP_GRACE_MS + 30 * 60_000) return null;   // เก่ามาก = รูปทั่วไป ไม่ใช่สลิป
  return data as { id: string; renewal_id: string; amount: number; fee: number; readd: boolean; label: string; attempts: number; created_at: string; expires_at: string };
}

/** ลูกค้าส่งรูปสลิป → ตรวจ (โควตาตรวจสลิปของร้าน) → ต่ออายุ */
export async function payBySlip(shop: ShopLite, pay: NonNullable<Awaited<ReturnType<typeof pendingPay>>>, file: Blob, customerName: string): Promise<string> {
  const d = db();
  const created = new Date(pay.created_at).getTime();
  const expires = new Date(pay.expires_at).getTime();
  if (Date.now() > expires + SLIP_GRACE_MS) {
    await d.from('shop_renewal_pays').update({ status: 'expired' }).eq('id', pay.id).eq('status', 'pending');
    return '❌ เกินเวลาตรวจสลิปแล้ว หากโอนแล้วกรุณาแจ้งร้านพร้อมสลิป';
  }
  if (pay.attempts >= MAX_ATTEMPTS) return '❌ ส่งสลิปเกินจำนวนครั้ง กรุณาแจ้งร้าน';
  const { data: rr } = await d.from('shop_renewals').select('*').eq('id', pay.renewal_id).maybeSingle();
  const r = rr as RenewalRow | null;
  if (!r) return '❌ ไม่พบรายการต่ออายุ กรุณาแจ้งร้าน';

  // ร้าน/ระบบไม่มีบริการตรวจสลิป → ให้แอดมินตรวจเองแล้วกดยืนยันในหลังบ้าน
  if (!slipServiceConfigured()) {
    await d.from('shop_renewal_pays').update({ attempts: pay.attempts + 1, last_error: 'รอแอดมินตรวจสลิป' }).eq('id', pay.id);
    await notifyRenewal(shop, '🧾 สลิปต่อเมล รอตรวจ', [`${customerName} · ${r.customer_email}`, `${pay.label} · ${baht(Number(pay.amount))}`, 'ตรวจยอดเงินเข้า แล้วกด "ยืนยันรับเงิน" ที่หลังบ้าน → ต่อเมล'], 0xf59e0b, true);
    return '📩 ได้รับสลิปแล้ว ร้านกำลังตรวจสอบ จะแจ้งผลในแชทนี้';
  }
  const { data: allowed, error: qErr } = await d.rpc('shop_use_slip', { p_shop: shop.id });
  if (qErr) { console.error('[renewals] quota', qErr.message); return '❌ ระบบตรวจสลิปขัดข้อง กรุณาลองใหม่'; }
  if (!allowed) {
    await notifyRenewal(shop, '🧾 สลิปต่อเมล รอตรวจ (โควตาตรวจสลิปหมด)', [`${customerName} · ${r.customer_email}`, `${pay.label} · ${baht(Number(pay.amount))}`, 'ตรวจยอดเงินเข้าเอง แล้วกด "ยืนยันรับเงิน" ที่หลังบ้าน → ต่อเมล'], 0xf59e0b, true);
    return '📩 ได้รับสลิปแล้ว ร้านกำลังตรวจสอบ จะแจ้งผลในแชทนี้';
  }
  await d.from('shop_renewal_pays').update({ attempts: pay.attempts + 1 }).eq('id', pay.id);
  const amount = Number(pay.amount);
  const res = await verifySlip(file, amount);
  const bad = async (msg: string) => { await d.from('shop_renewal_pays').update({ last_error: msg }).eq('id', pay.id); return `❌ ${msg}`; };
  if (!res.ok) return bad(res.message);
  const s = res.data;
  if (Math.abs(Number(s.amount) - amount) >= 0.005) return bad(`ยอดในสลิป ${baht(Number(s.amount))} ไม่ตรงกับยอดที่ต้องโอน ${baht(amount)}`);
  if (!receiverIsShop(s.receiver, shop)) return bad('บัญชีผู้รับในสลิปไม่ใช่บัญชีของร้านนี้');
  const paidAt = Date.parse(s.transTimestamp);
  if (!Number.isFinite(paidAt) || paidAt < created - SKEW) return bad('สลิปนี้โอนก่อนสร้าง QR ใช้ไม่ได้');
  if (paidAt > expires + SKEW) return bad('โอนหลัง QR หมดอายุ กรุณาแจ้งร้านพร้อมสลิป');

  const slip = { transRef: s.transRef, at: s.transTimestamp, amount: s.amount, sender: s.sender?.displayName || s.sender?.name || null, bank: s.sendingBank ?? null };
  return completePay(shop, pay.id, s.transRef, slip, customerName);
}

/** ปิดรายการจ่าย (สลิปผ่าน / แอดมินกดยืนยันเอง) → เลื่อนวันหมดอายุ + แจ้งร้าน · คืนข้อความตอบลูกค้า */
export async function completePay(shop: Pick<Shop, 'id' | 'name'>, payId: string, ref: string, slip: Record<string, unknown>, customerName: string): Promise<string> {
  const d = db();
  const { data: until, error } = await d.rpc('shop_renewal_paid', { p_pay: payId, p_ref: ref, p_slip: slip });
  if (error || !until) {
    if (/DUPLICATE_SLIP/.test(error?.message ?? '')) { await d.from('shop_renewal_pays').update({ last_error: 'สลิปนี้ถูกใช้ไปแล้ว' }).eq('id', payId); return '❌ สลิปนี้ถูกใช้ไปแล้ว'; }
    if (/NOT_PENDING/.test(error?.message ?? '')) return '✅ รายการนี้ชำระเรียบร้อยแล้ว';
    console.error('[renewals] paid', error?.message);
    return '❌ บันทึกไม่สำเร็จ กรุณาแจ้งร้านพร้อมสลิป';
  }
  const { data: p } = await d.from('shop_renewal_pays').select('label, amount, readd, shop_renewals(customer_email, fam_email)').eq('id', payId).maybeSingle();
  const rr = p?.shop_renewals as unknown as { customer_email: string; fam_email: string } | null;
  const lines = [`${customerName} · ${rr?.customer_email ?? ''}`, ...(rr?.fam_email ? [`fam: ${rr.fam_email}`] : []), `${p?.label ?? ''} · ${baht(Number(p?.amount ?? 0))}`, `ใช้ได้ถึง ${dayTh(String(until))}`];
  if (p?.readd) await notifyRenewal(shop, '➕ ลูกค้าต่อหลังลบเมล — เพิ่มเมลกลับเข้า fam', [...lines, '⚠️ ระบบต่อวันให้แล้ว แต่ต้องเชิญเมลลูกค้ากลับเข้า fam เอง'], 0xf59e0b, true);
  else await notifyRenewal(shop, '🔁 ลูกค้าต่อเมลแล้ว', lines, 0x22c55e);
  return `✅ ได้รับเงินแล้ว ต่ออายุเรียบร้อย\nเมล: ${rr?.customer_email ?? ''}\nใช้ได้ถึง ${dayTh(String(until))}\nขอบคุณค่ะ 🙏`;
}

// ---------- งานเป็นรอบ (cron ทุก 1 นาที ผ่าน /api/internal/renewals) ----------
/**
 * ทุกร้านที่เชื่อม LINE + แพ็กเกจ Pro/Max:
 * - เหลือ ≤ N วัน → ส่ง LINE เตือนครั้งเดียวต่อรอบ (09:00–20:59 เท่านั้น) · ยังไม่ผูกแชท / ส่งไม่ได้ → แจ้งร้าน
 * - เลยกำหนดต่อ (วันหมด + grace) ยังไม่ต่อ และยังไม่ลบเมล → แจ้งร้านให้ลบเมลออกจาก fam
 */
export async function sweepRenewals() {
  const d = db();
  const out = { shops: 0, reminded: 0, unlinked: 0, lapsed: 0 };
  const { data: lines, error } = await d.from('shop_line').select('shop_id');
  if (error || !lines?.length) return out;
  const { data: shops } = await d.from('shops').select('id, name, slug, plan, active, promptpay_id, receiver_name').in('id', lines.map((l) => l.shop_id)).eq('active', true);
  const hour = new Date(Date.now() + 7 * 3_600_000).getUTCHours();

  for (const shop of (shops ?? []) as ShopLite[]) {
    if (!renewAllowed(shop.plan)) continue;
    out.shops++;
    try {
      const st = await renewSettings(shop.id);
      if (hour >= 9 && hour < 21) {
        const { data: due } = await d.from('shop_renewals').select('*').eq('shop_id', shop.id).eq('status', 'active')
          .lte('expires_on', bkkDay(st.remindDays)).gte('expires_on', bkkDay(-st.graceDays)).is('removed_at', null).limit(50);
        const line = await shopLine(shop.id);
        for (const r of (due ?? []) as RenewalRow[]) {
          if (r.reminded_for === r.expires_on) continue;
          const { data: claimed } = await d.from('shop_renewals').update({ reminded_for: r.expires_on }).eq('id', r.id)
            .or(`reminded_for.is.null,reminded_for.neq.${r.expires_on}`).select('id');
          if (!claimed?.length) continue;
          const sent = line && r.line_user_id ? await pushLine(line.token, r.line_user_id, [await renewalFlex(r)]) : false;
          if (sent) { out.reminded++; continue; }
          out.unlinked++;
          await notifyRenewal(shop, '📭 เตือนต่อเมลทาง LINE ไม่ได้', [
            `เมลลูกค้า: ${r.customer_email}`, ...(r.fam_email ? [`fam: ${r.fam_email}`] : []), `หมดอายุ ${dayTh(r.expires_on)}`,
            r.line_user_id ? 'ลูกค้าบล็อก / ยกเลิกเพื่อน LINE ร้าน หรือโควตาข้อความ LINE หมด — ทักลูกค้าเอง' : `ยังไม่ผูกแชท — ส่งรหัส ${r.link_code} ให้ลูกค้าพิมพ์ใน LINE ร้าน`,
          ], 0xf59e0b);
        }
      }
      const { data: lapsed } = await d.from('shop_renewals').select('*').eq('shop_id', shop.id).eq('status', 'active').is('removed_at', null)
        .lt('expires_on', bkkDay(-st.graceDays)).limit(50);
      for (const r of (lapsed ?? []) as RenewalRow[]) {
        if (r.lapsed_for === r.expires_on) continue;
        const { data: claimed } = await d.from('shop_renewals').update({ lapsed_for: r.expires_on }).eq('id', r.id)
          .or(`lapsed_for.is.null,lapsed_for.neq.${r.expires_on}`).select('id');
        if (!claimed?.length) continue;
        out.lapsed++;
        await notifyRenewal(shop, '⌛ เลยกำหนดต่อแล้ว ลูกค้ายังไม่ต่อ — ลบเมลออกได้', [
          `เมลลูกค้า: ${r.customer_email}`, ...(r.fam_email ? [`fam: ${r.fam_email}`] : []), `หมดเมื่อ ${dayTh(r.expires_on)} · กำหนดต่อ ${dayTh(deadlineOf(r, st))}`,
          `ลบเมลลูกค้าออกจาก fam แล้วกด "ลบเมลแล้ว" ที่หลังบ้าน → ต่อเมล (ลูกค้ามาต่อทีหลัง +${st.removedFee} บาท)`,
        ], 0xdc2626);
      }
    } catch (e) {
      console.error('[renewals] sweep', shop.id, e);
    }
  }
  return out;
}
