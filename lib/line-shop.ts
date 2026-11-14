import 'server-only';
import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { can } from '@/lib/plan';
import { decrypt } from '@/lib/secret';
import { accentHex } from '@/lib/colors';
import { loadProducts, type Product } from '@/lib/catalog';
import { createTopup } from '@/lib/topup';
import { verifyTopupSlip } from '@/lib/topup-slip';
import { notifyOrderPaid, notifyRenewal } from '@/lib/notify';
import { signLink, type LineMessage } from '@/lib/line';
import { to } from '@/lib/routes';
import { DEFAULT_CONFIG, MENU_ITEMS, botText, normalizeConfig, type BotConfig, type MenuKey } from '@/lib/line-bot-config';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Shop } from '@/lib/shop';

/**
 * ขายสินค้าใน LINE OA ของร้าน (migration 0029 · แพ็กเกจ Max · ร้านเปิด "ขายใน LINE")
 * ลูกค้าไม่ต้องสมัคร: กดปุ่มครั้งแรก → สร้างบัญชีลูกค้าร้านเบื้องหลัง (shop_customers.line_user_id)
 * ออเดอร์ / สต็อก / จอ / ราคา ตรวจในฐานข้อมูลชุดเดียวกับหน้าเว็บร้าน (shop_create_order / shop_pay_order)
 */

export const lineShopAllowed = (shop: Pick<Shop, 'plan'> & { line_shop?: boolean | null }) => can(shop.plan, 'line_shop') && shop.line_shop !== false;

const MUTED = '#8a8a8a';
const RED = '#d14343';
const AWAIT_MS = 15 * 60_000;
const HANDOFF_MS = 10 * 60_000;
const baht = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const dateTh = (iso: string) => new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const shopUrl = (slug: string) => `https://${slug}.${process.env.SHOP_ROOT_DOMAIN || 'sysrent.shop'}`;
const UUID = /^[0-9a-f-]{36}$/i;

// ---------- ข้อความ ----------
const pb = (label: string, data: string, displayText?: string) => ({ type: 'postback', label: label.slice(0, 40), data, ...(displayText ? { displayText: displayText.slice(0, 300) } : {}) });
const qr = (label: string, data: string, displayText?: string) => ({ type: 'action', action: { ...pb(label.slice(0, 20), data, displayText) } });
// ---------- ตั้งค่าบอทของร้าน (หลังบ้าน → บอท LINE) ----------
type BotCtx = { cfg: BotConfig; shop: Shop; name: string };
const botCtx = new AsyncLocalStorage<BotCtx>();
/** ทำงานในนามร้านนี้ + การตั้งค่าบอทของร้าน (ทุกข้อความ / ปุ่มข้างในใช้ค่านี้) */
export const withBotCtx = <T>(v: BotCtx, f: () => T): T => botCtx.run(v, f);
const cfgNow = () => botCtx.getStore()?.cfg ?? DEFAULT_CONFIG;

const cfgCache = new Map<string, { at: number; v: BotConfig }>();
/** ตั้งค่าบอทของร้าน (จำไว้ 30 วินาที · บันทึกในหลังบ้านแล้วล้าง) · ยังไม่รัน 0030 = ค่าเริ่มต้น */
export async function botConfig(shopId: string): Promise<BotConfig> {
  const hit = cfgCache.get(shopId);
  if (hit && Date.now() - hit.at < 30_000) return hit.v;
  const { data, error } = await db().from('shops').select('line_bot').eq('id', shopId).maybeSingle();
  const v = normalizeConfig(error ? {} : data?.line_bot);
  cfgCache.set(shopId, { at: Date.now(), v });
  return v;
}
export const forgetBotConfig = (shopId: string) => cfgCache.delete(shopId);

/** ปุ่มเมนู (ตามลำดับ / เปิด-ปิดที่ร้านตั้ง) → [ป้าย, action LINE] */
function menuActions(renewals: boolean): { key: MenuKey; label: string; action: Record<string, unknown> }[] {
  const c = botCtx.getStore();
  const cfg = c?.cfg ?? DEFAULT_CONFIG;
  const web = c ? shopUrl(c.shop.slug) : '';
  return cfg.menu.filter((m) => m.on).flatMap((m): { key: MenuKey; label: string; action: Record<string, unknown> }[] => {
    const it = MENU_ITEMS[m.key];
    const label = `${it.icon} ${it.label}`;
    switch (m.key) {
      case 'shop': return [{ key: m.key, label, action: pb(label, 'a=cats', 'ดูสินค้า') }];
      case 'cart': return [{ key: m.key, label, action: pb(label, 'a=cart', 'ตะกร้า') }];
      case 'orders': return [{ key: m.key, label, action: pb(label, 'a=orders', 'ออเดอร์ของฉัน') }];
      case 'renew': return renewals ? [{ key: m.key, label, action: pb(label, 'a=myrn', 'ต่อเมล') }] : [];
      case 'otp': return c && can(c.shop.plan, 'otp') ? [{ key: m.key, label, action: { type: 'uri', label: label.slice(0, 20), uri: `${web}${to('/otp')}` } }] : [];
      case 'web': return c ? [{ key: m.key, label, action: { type: 'uri', label: label.slice(0, 20), uri: web } }] : [];
      case 'admin': return [{ key: m.key, label, action: pb(label, 'a=admin', 'คุยกับร้าน') }];
    }
  });
}
export const shopMenu = (renewals: boolean) => menuActions(renewals).map((m) => ({ type: 'action', action: { ...m.action, label: String(m.action.label ?? m.label).slice(0, 20) } }));
const text = (t: string, quick?: unknown[]): LineMessage => ({ type: 'text', text: t.slice(0, 5000), ...(quick?.length ? { quickReply: { items: quick.slice(0, 13) } } : {}) });
const tx = (s: string, o: Record<string, unknown> = {}): LineMessage => ({ type: 'text', text: s || '-', wrap: true, ...o });
const flex = (altText: string, contents: LineMessage): LineMessage => ({ type: 'flex', altText: altText.slice(0, 400), contents });
const btn = (accent: string, label: string, data: string, displayText?: string, primary = true): LineMessage => ({
  type: 'button', height: 'sm', style: primary ? 'primary' : 'secondary', ...(primary ? { color: accent } : {}), action: pb(label, data, displayText),
});

/** รูปสินค้าให้ LINE (ต้องเป็น https · LINE ไม่รับ webp → ผ่าน /api/line/img แปลงเป็น JPEG) */
const imgUrl = (shop: Pick<Shop, 'slug'>, p: Pick<Product, 'id' | 'image'>) => (p.image ? `${shopUrl(shop.slug)}/api/line/img/${p.id}?v=${signLink(p.image).slice(0, 8)}` : null);

// ---------- ลูกค้า + สถานะแชท ----------
type CartLine = { option_id: string; qty: number; info: string };
export type Sess = { shopId: string; lineId: string; customerId: string; username: string; name: string; balance: number; cart: CartLine[]; awaiting: { option_id: string; since: string } | null; handoffAt: string | null };

/** หา / สร้างบัญชีลูกค้าร้านของคน LINE นี้ (ชื่อผู้ใช้ line_xxxxxx · รหัสผ่านสุ่มที่ไม่มีใครรู้ = เข้าเว็บด้วยรหัสไม่ได้) */
async function ensureCustomer(shop: Shop, lineId: string, name: string): Promise<string | null> {
  const d = db();
  const find = async () => (await d.from('shop_customers').select('id').eq('shop_id', shop.id).eq('line_user_id', lineId).maybeSingle()).data?.id as string | undefined;
  const have = await find();
  if (have) return have;
  const pass = await hashPassword(randomBytes(24).toString('base64url'));
  for (let i = 0; i < 5; i++) {
    const username = 'line_' + randomBytes(6).toString('hex').slice(0, 10);
    const { data, error } = await d.from('shop_customers').insert({ shop_id: shop.id, username, pass_hash: pass, contact: `LINE: ${name || '-'}`.slice(0, 100), line_user_id: lineId }).select('id').single();
    if (!error && data) return data.id;
    if (error?.code !== '23505') { console.error('[line-shop] create customer', error?.message); return null; }
    const again = await find();   // สร้างซ้อนกันสองคำขอ
    if (again) return again;
  }
  return null;
}

export async function loadSess(shop: Shop, lineId: string, name: string, create: boolean): Promise<Sess | null> {
  const d = db();
  let { data: s } = await d.from('shop_line_sessions').select('*').eq('shop_id', shop.id).eq('line_user_id', lineId).maybeSingle();
  if (!s) {
    if (!create) return null;
    const customerId = await ensureCustomer(shop, lineId, name);
    if (!customerId) return null;
    await d.from('shop_line_sessions').upsert({ shop_id: shop.id, line_user_id: lineId, customer_id: customerId }, { onConflict: 'shop_id,line_user_id', ignoreDuplicates: true });
    ({ data: s } = await d.from('shop_line_sessions').select('*').eq('shop_id', shop.id).eq('line_user_id', lineId).maybeSingle());
    if (!s) return null;
  }
  const { data: c } = await d.from('shop_customers').select('username, balance, blocked').eq('id', s.customer_id).maybeSingle();
  if (!c || c.blocked) return null;
  return {
    shopId: shop.id, lineId, customerId: s.customer_id, username: c.username, name: name || c.username, balance: Number(c.balance),
    cart: Array.isArray(s.cart) ? (s.cart as CartLine[]) : [], awaiting: (s.awaiting as Sess['awaiting']) ?? null, handoffAt: s.handoff_at,
  };
}
/** ลูกค้ากดคำสั่งอื่นระหว่างที่บอทรอให้พิมพ์ข้อมูล → เลิกรอ */
export async function clearAwaiting(s: Sess) {
  if (s.awaiting) await save(s, { awaiting: null });
}
async function save(s: Sess, patch: Partial<{ cart: CartLine[]; awaiting: Sess['awaiting']; handoff_at: string }>) {
  if (patch.cart) s.cart = patch.cart;
  if ('awaiting' in patch) s.awaiting = patch.awaiting ?? null;
  await db().from('shop_line_sessions').update({ ...patch, updated_at: new Date().toISOString() }).eq('shop_id', s.shopId).eq('line_user_id', s.lineId);
}

// ---------- หน้าร้าน ----------
/** จำรายการสินค้าไว้ 20 วินาทีต่อร้าน (ลูกค้ากดเร็ว ไม่ต้องรอฐานข้อมูลทุกครั้ง · ตอนสั่งตรวจของจริงเสมอ) */
const memo = new Map<string, { at: number; v: Promise<Product[]> }>();
function products(shopId: string): Promise<Product[]> {
  const hit = memo.get(shopId);
  if (hit && Date.now() - hit.at < 20_000) return hit.v;
  const v = loadProducts(shopId);
  memo.set(shopId, { at: Date.now(), v });
  v.catch(() => memo.delete(shopId));
  return v;
}

function card(o: { hero?: string | null; title: string; lines?: (string | null | false | undefined)[]; buttons: LineMessage[] }): LineMessage {
  return {
    type: 'bubble', size: 'kilo',
    ...(o.hero ? { hero: { type: 'image', url: o.hero, size: 'full', aspectRatio: '1:1', aspectMode: 'cover' } } : {}),
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [tx(o.title, { weight: 'bold', size: 'md', maxLines: 3 }), ...(o.lines ?? []).filter((x): x is string => Boolean(x)).map((x) => tx(x, { size: 'xs', color: MUTED, maxLines: 4 }))] },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: o.buttons },
  };
}
/** carousel 11 ใบ + ใบ "ดูต่อ" (ขนาดเดียวกันทุกใบ — LINE ไม่รับขนาดปน) · หน้าเกิน = กลับหน้าแรก */
function paged<T>(accent: string, items: T[], page: number, toCard: (x: T) => LineMessage, more: (n: number) => string): LineMessage {
  const per = items.length > 12 ? 11 : 12;
  if (page > 0 && page * per >= items.length) page = 0;
  const cards = items.slice(page * per, page * per + per).map(toCard);
  if (items.length > (page + 1) * per) cards.push(card({ title: 'ยังมีอีก', lines: [`อีก ${items.length - (page + 1) * per} รายการ`], buttons: [btn(accent, 'ดูต่อ ›', more(page + 1))] }));
  return { type: 'carousel', contents: cards };
}

async function showCategories(shop: Shop, accent: string, renewals: boolean): Promise<LineMessage[]> {
  const list = (await products(shop.id)).filter((p) => p.options.some((o) => o.active));
  if (!list.length) return [text('ตอนนี้ร้านยังไม่มีสินค้าเปิดขาย', shopMenu(renewals))];
  const cats = [...new Map(list.map((p) => [p.category || 'สินค้า', 0])).keys()];
  const count = (c: string) => list.filter((p) => (p.category || 'สินค้า') === c).length;
  return [flex(`สินค้า ${shop.name}`, {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
      tx(shop.name, { weight: 'bold', size: 'lg' }),
      tx('เลือกหมวด แล้วกดสั่งซื้อในแชทนี้ได้เลยค่ะ', { size: 'xs', color: MUTED }),
      ...cats.slice(0, 20).map((c, i) => ({
        type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'md', cornerRadius: 'lg', paddingAll: 'md', backgroundColor: '#f5f5fb',
        action: pb(c, `a=cat&i=${i}`, `ดูหมวด ${c}`),
        contents: [
          { type: 'box', layout: 'vertical', flex: 1, contents: [tx(c, { weight: 'bold', size: 'sm' }), tx(`${count(c)} รายการ`, { size: 'xs', color: MUTED })] },
          tx('›', { size: 'xl', color: accent, flex: 0 }),
        ],
      })),
    ] },
  })];
}

function productCard(shop: Shop, accent: string, p: Product, all = false): LineMessage {
  const opts = p.options.filter((o) => o.active);
  const max = all ? 10 : 4;
  const buttons = opts.slice(0, max).map((o) => {
    const out = o.stock !== null && o.stock < 1;
    return btn(accent, `${o.name} · ${out ? 'หมด' : baht(o.price)}`, `a=add&o=${o.id}`, `เลือก ${p.name} · ${o.name}`, !out);
  });
  if (opts.length > max) buttons.push(btn(accent, `ดูแพ็กเกจทั้งหมด (${opts.length})`, `a=prod&p=${p.id}`, undefined, false));
  if (!buttons.length) buttons.push(btn(accent, 'ยังไม่เปิดขาย', 'a=noop', undefined, false));
  const cfg = cfgNow();
  const lines = [
    p.badge, p.from !== null && `เริ่ม ${baht(p.from)}`,
    cfg.card.sold && p.sold > 0 && `ขายแล้ว ${p.sold.toLocaleString('th-TH')} ชิ้น`,
    !p.inStock ? 'สินค้าหมดชั่วคราว' : cfg.card.stock && p.left !== null ? `เหลือ ${p.left} ชิ้น` : null,
    p.askInfo && `ต้องกรอก: ${p.askInfo}`, all && p.description,
  ];
  // กะทัดรัด: รูปเล็กข้างชื่อ (เลื่อนดูได้ไว) · รูปใหญ่: รูปเต็มด้านบน
  if (cfg.card.style === 'compact' && !all) {
    const img = imgUrl(shop, p);
    return {
      type: 'bubble', size: 'kilo',
      body: { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
        ...(img ? [{ type: 'image', url: img, size: 'xs', aspectRatio: '1:1', aspectMode: 'cover', flex: 0 }] : []),
        { type: 'box', layout: 'vertical', spacing: 'xs', flex: 1, contents: [tx(p.name, { weight: 'bold', size: 'sm', maxLines: 3 }), ...lines.filter((x): x is string => Boolean(x)).map((x) => tx(x, { size: 'xxs', color: MUTED, maxLines: 2 }))] },
      ] },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons },
    };
  }
  return card({ hero: imgUrl(shop, p), title: p.name, lines, buttons });
}

async function showCategory(shop: Shop, accent: string, idx: number, page: number, renewals: boolean): Promise<LineMessage[]> {
  const list = (await products(shop.id)).filter((p) => p.options.some((o) => o.active));
  const cats = [...new Map(list.map((p) => [p.category || 'สินค้า', 0])).keys()];
  const c = cats[idx];
  if (c === undefined) return showCategories(shop, accent, renewals);
  const items = list.filter((p) => (p.category || 'สินค้า') === c);
  return [flex(`สินค้าหมวด ${c}`, paged(accent, items, page, (p) => productCard(shop, accent, p), (n) => `a=cat&i=${idx}&p=${n}`))];
}

async function showProduct(shop: Shop, accent: string, id: string): Promise<LineMessage[]> {
  const p = (await products(shop.id)).find((x) => x.id === id);
  return p ? [flex(p.name, productCard(shop, accent, p, true))] : [text('ไม่พบสินค้านี้แล้ว')];
}

// ---------- ตะกร้า ----------
type OptRow = { id: string; name: string; price: number; active: boolean; shop_products: { name: string; shop_id: string; active: boolean; fulfillment: string; ask_info: string } | null };
const OPT = 'id, name, price, active, shop_products!inner(name, shop_id, active, fulfillment, ask_info)';

async function addToCart(shop: Shop, s: Sess, optionId: string, info = ''): Promise<LineMessage[]> {
  if (!UUID.test(optionId)) return [text('ไม่พบสินค้า')];
  const { data } = await db().from('shop_options').select(OPT).eq('id', optionId).maybeSingle();
  const o = data as unknown as OptRow | null;
  const p = o?.shop_products;
  if (!o || !p || p.shop_id !== shop.id || !o.active || !p.active) return [text('สินค้านี้ปิดขายไปแล้ว กรุณาเลือกใหม่')];
  const label = `${p.name} · ${o.name}`;
  if (p.ask_info && !info) {
    await save(s, { awaiting: { option_id: o.id, since: new Date().toISOString() } });
    return [text(`กรุณาพิมพ์ ${p.ask_info} สำหรับ\n"${label}"`, [qr('ยกเลิก', 'a=cancel', 'ยกเลิก')])];
  }
  const cart = [...s.cart];
  const same = p.fulfillment === 'stock' ? cart.find((l) => l.option_id === o.id && l.info === info) : undefined;
  if (same) same.qty = Math.min(20, same.qty + 1);
  else {
    if (cart.length >= 20) return [text('ตะกร้าเต็มแล้ว (สูงสุด 20 รายการ) กรุณาชำระเงินก่อน')];
    cart.push({ option_id: o.id, qty: 1, info });
  }
  await save(s, { cart, awaiting: null });
  return [text(`✅ เพิ่ม "${label}"${info ? `\n(${p.ask_info}: ${info})` : ''} ลงตะกร้าแล้ว\nในตะกร้ามี ${cart.length} รายการ`, [qr('🛒 ดูตะกร้า / ชำระเงิน', 'a=cart', 'ตะกร้า'), qr('🛍 เลือกสินค้าต่อ', 'a=cats', 'ดูสินค้า')])];
}

async function showCart(shop: Shop, accent: string, s: Sess): Promise<LineMessage[]> {
  if (!s.cart.length) return [text('ตะกร้ายังว่างอยู่', [qr('🛍 ดูสินค้า', 'a=cats', 'ดูสินค้า')])];
  const { data } = await db().from('shop_options').select(OPT).in('id', s.cart.map((l) => l.option_id));
  const opts = new Map(((data ?? []) as unknown as OptRow[]).map((o) => [o.id, o]));
  let total = 0;
  const rows = s.cart.map((l, i) => {
    const o = opts.get(l.option_id);
    const ok = Boolean(o?.active && o.shop_products?.active && o.shop_products.shop_id === shop.id);
    if (ok) total += Number(o!.price) * l.qty;
    return {
      type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
        { type: 'box', layout: 'vertical', flex: 5, contents: [
          tx(o ? `${o.shop_products?.name} · ${o.name}` : 'สินค้าที่ถูกลบ', { size: 'sm', weight: 'bold', maxLines: 2 }),
          tx([l.info && `${o?.shop_products?.ask_info || 'ข้อมูล'}: ${l.info}`, ok ? `${l.qty} × ${baht(Number(o!.price))}` : 'ปิดขายแล้ว — กรุณาลบออก'].filter(Boolean).join('\n'), { size: 'xs', color: ok ? MUTED : RED }),
        ] },
        { type: 'button', style: 'link', height: 'sm', flex: 2, action: pb('ลบ', `a=rm&i=${i}&o=${l.option_id.slice(0, 8)}`) },
      ],
    };
  });
  return [flex(`ตะกร้า ${s.cart.length} รายการ · ${baht(total)}`, {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
      tx('🛒 ตะกร้าสินค้า', { weight: 'bold', size: 'lg' }), { type: 'separator' }, ...rows, { type: 'separator' },
      { type: 'box', layout: 'horizontal', contents: [tx('รวม', { weight: 'bold' }), tx(baht(total), { weight: 'bold', align: 'end', color: accent })] },
      tx('ราคาตัวแทน / คูปอง ใช้ได้ที่หน้าเว็บร้าน', { size: 'xxs', color: MUTED }),
    ] },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
      btn(accent, `ชำระเงิน ${baht(total)}`, 'a=pay', 'ชำระเงิน'),
      btn(accent, 'เลือกสินค้าต่อ', 'a=cats', 'ดูสินค้า', false),
      { type: 'button', style: 'link', height: 'sm', action: pb('ล้างตะกร้า', 'a=clear', 'ล้างตะกร้า') },
    ] },
  })];
}

// ---------- ชำระเงิน ----------
const ORDER_ERR: Record<string, string> = {
  EMPTY_CART: 'ตะกร้ายังว่างอยู่', CART_TOO_BIG: 'สั่งได้สูงสุด 20 รายการ', OPTION_UNAVAILABLE: 'มีสินค้าในตะกร้าที่ปิดขายแล้ว กรุณาลบออก',
  OUT_OF_STOCK: 'สินค้าหมดหรือเหลือไม่พอ', NEED_INFO: 'กรุณากรอกข้อมูลที่ร้านขอ', ORDER_EXPIRED: 'ออเดอร์หมดเวลาชำระ กรุณาสั่งใหม่',
  INSUFFICIENT_FUNDS: 'ยอดเงินในกระเป๋าไม่พอ', NOT_PENDING: 'ออเดอร์นี้ชำระเงินแล้ว', ORDER_NOT_FOUND: 'ไม่พบออเดอร์',
};
const orderErr = (m = '') => { const [code, name] = m.split(':'); const t = ORDER_ERR[code.trim()]; if (!t) console.error('[line-shop] db', m); return t ? `${t}${name ? ` (${name.trim()})` : ''}` : 'ทำรายการไม่สำเร็จ กรุณาลองใหม่'; };

async function checkout(shop: Shop, accent: string, s: Sess, renewals: boolean): Promise<LineMessage[]> {
  if (!s.cart.length) return showCart(shop, accent, s);
  if (!shop.active) return [text('ร้านปิดรับออเดอร์ชั่วคราว')];
  const d = db();
  const { count } = await d.from('shop_orders').select('id', { count: 'exact', head: true }).eq('customer_id', s.customerId).eq('status', 'pending').gt('expires_at', new Date().toISOString());
  if ((count ?? 0) >= 5) return [text('มีออเดอร์รอชำระหลายรายการ กรุณาชำระหรือรอให้หมดเวลาก่อน', [qr('📦 ออเดอร์ของฉัน', 'a=orders', 'ออเดอร์ของฉัน')])];
  const { data, error } = await d.rpc('shop_create_order', { p_shop: shop.id, p_customer: s.customerId, p_lines: s.cart.map((l) => ({ option_id: l.option_id, qty: l.qty, info: l.info })), p_coupon: null });
  if (error || !data) return [text(`❌ ${orderErr(error?.message)}`, [qr('🛒 ดูตะกร้า', 'a=cart', 'ตะกร้า'), qr('💬 คุยกับแอดมิน', 'a=admin', 'คุยกับแอดมิน')])];
  const o = data as { id: string; code: string; total: number };
  await save(s, { cart: [] });
  // มีเงินในกระเป๋าพอ → ให้เลือกจ่ายจากกระเป๋า
  if (s.balance >= Number(o.total)) {
    return [flex(`ออเดอร์ #${o.code} · ${baht(Number(o.total))}`, card({
      title: `ออเดอร์ #${o.code}`, lines: [`ยอดชำระ ${baht(Number(o.total))}`, `เงินในกระเป๋า ${baht(s.balance)}`],
      buttons: [btn(accent, 'จ่ายด้วยเงินในกระเป๋า', `a=wallet&c=${o.code}`, 'จ่ายด้วยเงินในกระเป๋า'), btn(accent, 'จ่ายด้วยพร้อมเพย์', `a=qr&c=${o.code}`, 'จ่ายด้วยพร้อมเพย์', false)],
    }))];
  }
  return qrMessages(shop, accent, s, o.id, o.code, renewals);
}

async function qrMessages(shop: Shop, accent: string, s: Sess, orderId: string, code: string, renewals: boolean): Promise<LineMessage[]> {
  const { data: o } = await db().from('shop_orders').select('total, shop_order_items(name, qty, total, customer_info)').eq('id', orderId).maybeSingle();
  if (!o) return [text('ไม่พบออเดอร์')];
  const t = await createTopup(shop, s.customerId, Number(o.total), orderId);
  if ('error' in t) return [text(`❌ ${t.error}`, shopMenu(renewals))];
  const url = `${shopUrl(shop.slug)}/api/line/qr/${t.topupId}?t=${signLink(t.topupId)}`;
  type I = { name: string; qty: number; total: number; customer_info: string | null };
  return [
    flex(`ออเดอร์ #${code} · ยอดชำระ ${baht(t.amount)}`, {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        tx(`🧾 ออเดอร์ #${code}`, { weight: 'bold', size: 'lg' }), { type: 'separator', margin: 'md' },
        ...((o.shop_order_items ?? []) as I[]).map((i) => ({ type: 'box', layout: 'horizontal', margin: 'sm', contents: [
          tx(`${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}${i.customer_info ? `\n→ ${i.customer_info}` : ''}`, { size: 'sm', flex: 5 }),
          tx(baht(Number(i.total)), { size: 'sm', align: 'end', flex: 2 }),
        ] })),
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'horizontal', margin: 'md', contents: [tx('ยอดชำระ', { weight: 'bold' }), tx(baht(t.amount), { weight: 'bold', align: 'end', color: accent })] },
        ...(t.amount !== Number(o.total) ? [tx('โอนให้ตรงทุกสตางค์ ระบบใช้เศษสตางค์จับคู่ยอดอัตโนมัติ', { size: 'xxs', color: MUTED })] : []),
        tx(`สแกนจ่ายภายใน ${hhmm(t.expiresAt)} น.`, { size: 'xs', color: MUTED }),
      ] },
    }),
    { type: 'image', originalContentUrl: url, previewImageUrl: url },
    text(`สแกน QR พร้อมเพย์ด้านบน ยอด ${baht(t.amount)}\nโอนแล้วส่ง "รูปสลิป" ในแชทนี้ได้เลย ระบบตรวจและส่งสินค้าให้อัตโนมัติ`),
  ];
}

async function orderByCode(s: Sess, code: string) {
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return null;
  const { data } = await db().from('shop_orders').select('id, code, total, status, expires_at').eq('code', code).eq('customer_id', s.customerId).maybeSingle();
  return data;
}

async function payByQr(shop: Shop, accent: string, s: Sess, code: string, renewals: boolean): Promise<LineMessage[]> {
  const o = await orderByCode(s, code);
  if (!o) return [text('ไม่พบออเดอร์')];
  if (o.status !== 'pending') return orderDetail(shop, s, code, renewals);
  if (new Date(o.expires_at).getTime() < Date.now()) return [text('ออเดอร์หมดเวลาชำระ กรุณาสั่งใหม่', shopMenu(renewals))];
  return qrMessages(shop, accent, s, o.id, o.code, renewals);
}

async function payByWallet(shop: Shop, s: Sess, code: string, renewals: boolean): Promise<LineMessage[]> {
  const o = await orderByCode(s, code);
  if (!o) return [text('ไม่พบออเดอร์')];
  const { error } = await db().rpc('shop_pay_order', { p_order: o.id, p_customer: s.customerId, p_paid_by: 'wallet' });
  if (error) return [text(`❌ ${orderErr(error.message)}`)];
  notifyOrderPaid(shop, o.id);
  return orderDetail(shop, s, o.code, renewals, PAID);
}

/** สลิปของ QR ออเดอร์ (รูปที่ลูกค้าส่ง · ไม่มี QR รอจ่าย = null → รูปทั่วไป บอทเงียบ) */
export async function shopSlip(shop: Shop, s: Sess, file: () => Promise<Blob | null>, renewals: boolean): Promise<LineMessage[] | null> {
  const { data: t } = await db().from('shop_topups').select('id, expires_at').eq('shop_id', shop.id).eq('customer_id', s.customerId).eq('status', 'pending')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!t || Date.now() > new Date(t.expires_at).getTime() + 40 * 60_000) return null;
  const blob = await file();
  if (!blob) return [text('โหลดรูปสลิปไม่สำเร็จ กรุณาส่งใหม่อีกครั้ง')];
  const r = await verifyTopupSlip(shop, { id: s.customerId, username: s.username }, t.id, blob);
  if (!r.ok) return [text(`❌ ${r.error}`, [qr('💬 คุยกับแอดมิน', 'a=admin', 'คุยกับแอดมิน')])];
  if (r.waiting) return [text(`📩 ${r.message ?? 'ได้รับสลิปแล้ว รอระบบยืนยันยอดเงินสักครู่'}`)];
  if (r.order) return orderDetail(shop, s, r.order, renewals, PAID);
  if (r.orderError) return [text(`⚠️ ${r.orderError}`, shopMenu(renewals))];
  return [text(`✅ เติมเงิน ${baht(r.amount)} เข้ากระเป๋าแล้ว`, shopMenu(renewals))];
}

// ---------- ออเดอร์ / ส่งของ ----------
/** ป้าย "จ่ายเงินสำเร็จ" → orderDetail ใส่ข้อความขอบคุณของร้านให้ */
const PAID = '__paid__';
const STATUS: Record<string, string> = { pending: 'รอชำระเงิน', processing: 'กำลังดำเนินการ', completed: 'สำเร็จ', cancelled: 'ยกเลิก', refunded: 'คืนเงินแล้ว', partial: 'สำเร็จบางรายการ', failed: 'ไม่สำเร็จ' };

async function orderDetail(shop: Shop, s: Sess, code: string, renewals: boolean, header?: string): Promise<LineMessage[]> {
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return [text('ไม่พบออเดอร์')];
  const d = db();
  const { data: o } = await d.from('shop_orders').select('id, code, total, status, expires_at, shop_order_items(id, name, qty, status, delivered, fulfillment, customer_info)')
    .eq('code', code).eq('customer_id', s.customerId).maybeSingle();
  if (!o) return [text('ไม่พบออเดอร์')];
  type I = { id: string; name: string; qty: number; status: string; delivered: string | null; fulfillment: string; customer_info: string | null };
  const items = (o.shop_order_items ?? []) as I[];
  const slotIds = items.filter((i) => i.fulfillment === 'slot' && i.status === 'delivered').map((i) => i.id);
  const { data: subs } = slotIds.length ? await d.from('shop_subscriptions').select('id').in('order_item_id', slotIds) : { data: [] as { id: string }[] };
  // ข้อความของร้าน (หลังบ้าน → บอท LINE): ขอบคุณหลังจ่าย · ยืนยันการจอง (สินค้าสั่งทำ)
  const cfg = cfgNow();
  const vars = { shop: shop.name, name: s.name, order: o.code, total: baht(Number(o.total)) };
  const top = header === PAID ? `✅ ${botText(cfg, 'thanks', vars)}` : header;
  const head = `${top ? top + '\n' : ''}📦 ออเดอร์ #${o.code} · ${baht(Number(o.total))}\nสถานะ: ${STATUS[o.status] ?? o.status}`;
  const parts = items.map((i) => {
    const l = [`▪️ ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}${i.customer_info ? ` → ${i.customer_info}` : ''}`];
    if (i.status === 'delivered' && i.fulfillment === 'slot') l.push('กดปุ่ม 🔑 ด้านล่างเพื่อดูอีเมล / รหัส / PIN');
    else if (i.status === 'delivered' && i.delivered) l.push(i.delivered.slice(0, 1500));
    else if (o.status !== 'pending') l.push(i.status === 'refunded' ? '(คืนเงินแล้ว)' : `(${botText(cfg, 'booking', vars)})`);
    return l.join('\n');
  });
  // ข้อความธรรมดา → ลูกค้ากดค้างคัดลอกรหัส / โค้ดได้
  const msgs: LineMessage[] = [text(head)];
  let buf = '';
  for (const p of parts) {
    if (buf && buf.length + p.length > 1800 && msgs.length < 4) { msgs.push(text(buf)); buf = ''; }
    buf += (buf ? '\n\n' : '') + p;
  }
  if (buf) msgs.push(text(buf));
  const quick = [
    ...(subs ?? []).slice(0, 6).map((x, n) => qr(`🔑 ดูรหัส${(subs ?? []).length > 1 ? ` #${n + 1}` : ''}`, `a=sec&s=${x.id}`, 'ดูรหัส')),
    ...(o.status === 'pending' && new Date(o.expires_at).getTime() > Date.now() ? [qr('💳 ชำระเงิน', `a=qr&c=${o.code}`, 'ชำระเงิน')] : []),
    ...shopMenu(renewals),
  ];
  const last = msgs.length - 1;
  msgs[last] = { ...msgs[last], quickReply: { items: quick.slice(0, 13) } };
  return msgs.slice(0, 5);
}

async function showOrders(accent: string, s: Sess, renewals: boolean): Promise<LineMessage[]> {
  const { data } = await db().from('shop_orders').select('code, status, total, created_at, expires_at').eq('customer_id', s.customerId).order('created_at', { ascending: false }).limit(10);
  if (!data?.length) return [text('ยังไม่มีออเดอร์', shopMenu(renewals))];
  return [flex('ออเดอร์ของฉัน', { type: 'carousel', contents: data.map((o) => {
    const waiting = o.status === 'pending' && new Date(o.expires_at).getTime() > Date.now();
    return card({
      title: `#${o.code}`, lines: [dateTh(o.created_at), `${baht(Number(o.total))} · ${o.status === 'pending' && !waiting ? 'หมดเวลาชำระ' : STATUS[o.status] ?? o.status}`],
      buttons: [...(waiting ? [btn(accent, 'ชำระเงิน', `a=qr&c=${o.code}`, `ชำระออเดอร์ #${o.code}`)] : []), btn(accent, 'ดูรายละเอียด', `a=ord&c=${o.code}`, `ดูออเดอร์ #${o.code}`, !waiting)],
    });
  }) })];
}

async function showSecret(shop: Shop, s: Sess, id: string): Promise<LineMessage[]> {
  if (!UUID.test(id)) return [text('ไม่พบรายการ')];
  const { data: sub } = await db().from('shop_subscriptions').select('status, ends_at, shop_slots(label, pin, shop_accounts(login, secret_enc, status))')
    .eq('id', id).eq('shop_id', shop.id).eq('customer_id', s.customerId).maybeSingle();
  if (!sub) return [text('ไม่พบรายการ')];
  if (sub.status !== 'active' || new Date(sub.ends_at).getTime() <= Date.now()) return [text('หมดอายุแล้ว — ซื้อใหม่เพื่อดูรหัส')];
  const slot = sub.shop_slots as unknown as { label: string; pin: string; shop_accounts: { login: string; secret_enc: string; status: string } };
  if (slot.shop_accounts.status === 'retired') return [text('บัญชีนี้ถูกเลิกใช้ กรุณาติดต่อร้าน')];
  let password: string;
  try { password = decrypt(slot.shop_accounts.secret_enc); } catch { return [text('ระบบขัดข้อง กรุณาติดต่อร้าน')]; }
  return [text([`🔑 ${slot.label}`, `อีเมล: ${slot.shop_accounts.login}`, `รหัสผ่าน: ${password}`, `โปรไฟล์: ${slot.label}`, slot.pin && `PIN: ${slot.pin}`, `ใช้ได้ถึง ${dateTh(sub.ends_at)}`].filter(Boolean).join('\n'))];
}

async function handoff(shop: Shop, s: Sess): Promise<LineMessage[]> {
  if (Date.now() - (s.handoffAt ? new Date(s.handoffAt).getTime() : 0) > HANDOFF_MS) {
    await save(s, { handoff_at: new Date().toISOString() });
    await notifyRenewal(shop, '💬 ลูกค้าใน LINE ขอคุยกับแอดมิน', [s.name, ...(s.cart.length ? [`ในตะกร้า ${s.cart.length} รายการ`] : []), 'ตอบได้ที่ LINE OA Manager → แชท'], 0x06c755, true);
  }
  return [text(botText(cfgNow(), 'handoff', { shop: shop.name, name: s.name }))];
}

/**
 * แอดมินส่งของ (สินค้าสั่งทำ) / คืนเงิน ในหลังบ้าน → ถ้าลูกค้าสั่งผ่าน LINE ร้าน แจ้งในแชทให้ด้วย
 * (push = นับโควตาข้อความ LINE ของร้าน · ร้านไม่ได้เชื่อม LINE / ลูกค้าไม่ได้มาจาก LINE = ไม่ทำอะไร)
 */
export async function lineItemNotice(shop: Pick<Shop, 'id'>, itemId: string, kind: 'deliver' | 'refund', content: string) {
  const d = db();
  const { data: it } = await d.from('shop_order_items').select('name, shop_orders!inner(code, shop_id, shop_customers!inner(line_user_id, contact))').eq('id', itemId).eq('shop_orders.shop_id', shop.id).maybeSingle();
  const o = it?.shop_orders as unknown as { code: string; shop_customers: { line_user_id: string | null; contact: string } } | undefined;
  const to = o?.shop_customers.line_user_id;
  if (!it || !o || !to) return;
  // ร้านปิด "ข้อความที่เสียโควตา" เรื่องนี้ไว้ → ลูกค้าดูเองที่ "ออเดอร์ของฉัน"
  const cfg = await botConfig(shop.id);
  if (!cfg.enabled || !cfg.push[kind]) return;
  const { shopLine, pushLine } = await import('@/lib/line');
  const line = await shopLine(shop.id);
  if (!line) return;
  const { data: sh } = await d.from('shops').select('name').eq('id', shop.id).maybeSingle();
  const name = o.shop_customers.contact.replace(/^LINE:\s*/, '');
  const body = kind === 'deliver'
    ? `✿ ${botText(cfg, 'deliver', { shop: sh?.name ?? '', name, order: o.code })}\n\n"${it.name}" (ออเดอร์ #${o.code})\n${content.slice(0, 1500)}`
    : `↩️ คืนเงิน "${it.name}" (ออเดอร์ #${o.code}) เข้ากระเป๋าเงินในร้านแล้ว\nเหตุผล: ${content.slice(0, 300)}\nใช้จ่ายออเดอร์ถัดไปได้เลย`;
  await pushLine(line.token, to, [{ type: 'text', text: body }]);
}

/** แจ้งในแชท LINE เมื่อร้านตอบเรื่องที่ลูกค้าแจ้งปัญหา (ร้านเปิด "ข้อความที่เสียโควตา → ร้านตอบเรื่องที่ลูกค้าแจ้งปัญหา") */
export async function lineReportNotice(shop: Pick<Shop, 'id' | 'name'>, reportId: string) {
  const d = db();
  const { data: r } = await d.from('shop_reports').select('topic, reply, status, shop_orders(code), shop_customers!inner(line_user_id)').eq('id', reportId).eq('shop_id', shop.id).maybeSingle();
  const to = (r?.shop_customers as unknown as { line_user_id: string | null } | null)?.line_user_id;
  if (!r || !to || !r.reply) return;
  const cfg = await botConfig(shop.id);
  if (!cfg.enabled || !cfg.push.report) return;
  const { shopLine, pushLine } = await import('@/lib/line');
  const line = await shopLine(shop.id);
  if (!line) return;
  const code = (r.shop_orders as unknown as { code: string } | null)?.code ?? '';
  await pushLine(line.token, to, [{ type: 'text', text: `💬 ร้านตอบเรื่อง "${r.topic}"${code ? ` (ออเดอร์ #${code})` : ''}\n\n${String(r.reply).slice(0, 1000)}${r.status === 'resolved' ? '\n\n✅ ปิดเรื่องแล้ว' : ''}` }]);
}

/** การ์ดต้อนรับ (แบบในตัวอย่างหลังบ้าน): หัวการ์ด + ข้อความต้อนรับของร้าน + ปุ่มเมนูตามที่ร้านเรียง */
export function welcome(shop: Shop, renewals: boolean): LineMessage[] {
  const c = botCtx.getStore();
  const cfg = c?.cfg ?? DEFAULT_CONFIG;
  const accent = accentHex(shop.accent);
  const items = menuActions(renewals);
  const logo = cfg.card.logo && /^https:\/\//.test(shop.logo_url) ? shop.logo_url : '';
  return [{
    type: 'flex', altText: `ยินดีต้อนรับสู่ ${shop.name}`,
    contents: {
      type: 'bubble', size: 'kilo',
      header: { type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center', backgroundColor: '#1f2333', paddingAll: 'lg', contents: [
        ...(logo ? [{ type: 'image', url: logo, size: 'xxs', aspectRatio: '1:1', aspectMode: 'cover', flex: 0 }] : []),
        { type: 'box', layout: 'vertical', contents: [tx('ยินดีต้อนรับ', { size: 'xxs', color: '#ffb6c8' }), tx(shop.name, { weight: 'bold', size: 'md', color: '#ffffff' })] },
      ] },
      body: { type: 'box', layout: 'vertical', contents: [tx(botText(cfg, 'welcome', { shop: shop.name, name: c?.name ?? '' }), { size: 'sm' })] },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: items.length
        ? items.map((m, i) => ({ type: 'button', height: 'sm', style: i === 0 ? 'primary' : 'secondary', ...(i === 0 ? { color: accent } : {}), action: { ...m.action, label: m.label.slice(0, 40) } }))
        : [tx('พิมพ์ข้อความทิ้งไว้ได้เลย ร้านจะตอบกลับ', { size: 'xs', color: MUTED, align: 'center' })] },
    },
  }];
}

export const SHOP_KEYWORDS: Record<string, string> = {
  'ดูสินค้า': 'cats', 'สินค้า': 'cats', 'สั่งซื้อ': 'cats', 'ตะกร้า': 'cart', 'ชำระเงิน': 'cart',
  'ออเดอร์': 'orders', 'ออเดอร์ของฉัน': 'orders', 'คุยกับแอดมิน': 'admin', 'ติดต่อแอดมิน': 'admin', 'เมนู': 'menu', 'menu': 'menu',
};

/** ปุ่ม / คำสั่งของร้านค้า · null = ไม่ใช่เรื่องร้านค้า */
export async function shopAction(shop: Shop, s: Sess, q: URLSearchParams, renewals: boolean): Promise<LineMessage[] | null> {
  const accent = accentHex(shop.accent);
  const page = Math.max(0, Math.min(30, Number(q.get('p')) || 0));
  switch (q.get('a')) {
    case 'menu': return welcome(shop, renewals);
    case 'cats': return showCategories(shop, accent, renewals);
    case 'cat': return showCategory(shop, accent, Number(q.get('i')) || 0, page, renewals);
    case 'prod': return showProduct(shop, accent, q.get('p') ?? '');
    case 'add': return addToCart(shop, s, q.get('o') ?? '');
    case 'cancel': await save(s, { awaiting: null }); return [text('ยกเลิกแล้ว', shopMenu(renewals))];
    case 'cart': return showCart(shop, accent, s);
    case 'rm': {
      const i = Number(q.get('i')), cart = [...s.cart];
      if (cart[i]?.option_id.startsWith(q.get('o') ?? '-')) cart.splice(i, 1);
      await save(s, { cart });
      return showCart(shop, accent, s);
    }
    case 'clear': await save(s, { cart: [], awaiting: null }); return [text('ล้างตะกร้าแล้ว', shopMenu(renewals))];
    case 'pay': return checkout(shop, accent, s, renewals);
    case 'qr': return payByQr(shop, accent, s, q.get('c') ?? '', renewals);
    case 'wallet': return payByWallet(shop, s, q.get('c') ?? '', renewals);
    case 'orders': return showOrders(accent, s, renewals);
    case 'ord': return orderDetail(shop, s, q.get('c') ?? '', renewals);
    case 'sec': return showSecret(shop, s, q.get('s') ?? '');
    case 'admin': return handoff(shop, s);
    case 'noop': return [];
    default: return null;
  }
}

/** ข้อความที่พิมพ์ตอนบอทรอข้อมูลที่ร้านขอ (เช่น อีเมล / ไอดีเกม) · null = ไม่ได้รออยู่ */
export async function shopTyped(shop: Shop, s: Sess, raw: string): Promise<LineMessage[] | null> {
  if (!s.awaiting || Date.now() - new Date(s.awaiting.since).getTime() > AWAIT_MS) return null;
  return addToCart(shop, s, s.awaiting.option_id, raw.slice(0, 300));
}
