/* =============================================================
   ตั้งค่าบอท LINE ของร้าน (shops.line_bot · migration 0030) — ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และหน้าหลังบ้าน (ไม่มีข้อมูลลับ)
   ร้านกดตั้งเองในหลังบ้าน → บอท LINE: น้ำเสียง · ข้อความ · ปุ่มเมนู · การ์ดสินค้า · ข้อความที่เสียโควตา
   ============================================================= */

export type Tone = 'friendly' | 'polite_f' | 'polite_m';
export const TONES: { key: Tone; label: string; sample: string }[] = [
  { key: 'friendly', label: 'เป็นกันเอง', sample: '"ได้รับสลิปแล้วค่า ขอบคุณน้า"' },
  { key: 'polite_f', label: 'สุภาพ (ค่ะ)', sample: '"ได้รับสลิปแล้วค่ะ ขอบคุณนะคะ"' },
  { key: 'polite_m', label: 'สุภาพ (ครับ)', sample: '"ได้รับสลิปแล้วครับ ขอบคุณนะครับ"' },
];

export type MsgKey = 'welcome' | 'thanks' | 'booking' | 'deliver' | 'handoff';
export const MESSAGES: { key: MsgKey; label: string; hint: string; vars: string[] }[] = [
  { key: 'welcome', label: 'ข้อความต้อนรับ', hint: 'บนการ์ดเมนู ตอนลูกค้าเพิ่มเพื่อนหรือพิมพ์ "เมนู"', vars: ['shop', 'name'] },
  { key: 'thanks', label: 'ขอบคุณหลังจ่ายเงิน', hint: 'บนใบเสร็จ หลังลูกค้าจ่ายเงินสำเร็จ', vars: ['shop', 'name', 'order', 'total'] },
  { key: 'booking', label: 'ยืนยันการจอง', hint: 'หลังจ่ายเงินสินค้าสั่งทำ บอกว่าร้านกำลังทำรายการให้', vars: ['shop', 'name', 'order'] },
  { key: 'deliver', label: 'แจ้งส่งของ', hint: 'ตอนร้านกดส่งของสินค้าสั่งทำในหลังบ้าน', vars: ['shop', 'name', 'order'] },
  { key: 'handoff', label: 'ตอบลูกค้าขอคุยกับร้าน', hint: 'ตอนลูกค้ากด "คุยกับร้าน"', vars: ['shop', 'name'] },
];
export const VAR_LABEL: Record<string, string> = { shop: 'ชื่อร้าน', name: 'ชื่อ LINE ลูกค้า', order: 'เลขออเดอร์', total: 'ยอดเงิน' };

/** ข้อความเริ่มต้นตามน้ำเสียง (ร้านเว้นช่องว่าง = ใช้อันนี้) */
export const DEFAULT_MSG: Record<Tone, Record<MsgKey, string>> = {
  friendly: {
    welcome: 'สวัสดีค่า 😊 สนใจตัวไหนกดสั่งได้เลยน้า มีอะไรสอบถามร้านได้ตลอดค่า',
    thanks: 'ได้รับเงินแล้วค่า ขอบคุณมากๆน้า 💕',
    booking: 'จองให้เรียบร้อยแล้วค่า ร้านกำลังทำรายการให้น้า เสร็จแล้วแจ้งในแชทนี้เลย',
    deliver: 'ส่งของให้แล้วค่า 📦 ได้รับของแล้วอย่าลืมเช็กด้วยน้า',
    handoff: 'ได้เลยค่า พิมพ์ทิ้งไว้ได้เลยน้า เดี๋ยวร้านรีบมาตอบ 🙏',
  },
  polite_f: {
    welcome: 'สวัสดีค่ะ ยินดีต้อนรับสู่ {shop} สนใจสินค้าตัวไหนกดสั่งได้เลยค่ะ',
    thanks: 'ได้รับเงินแล้วค่ะ ขอบคุณที่อุดหนุนนะคะ',
    booking: 'รับออเดอร์ #{order} เรียบร้อยแล้วค่ะ ร้านกำลังดำเนินการให้ เสร็จแล้วจะแจ้งในแชทนี้นะคะ',
    deliver: 'ร้านจัดส่งสินค้าให้แล้วค่ะ รบกวนตรวจสอบด้วยนะคะ',
    handoff: 'รับทราบค่ะ พิมพ์รายละเอียดทิ้งไว้ได้เลย แอดมินจะตอบกลับโดยเร็วที่สุดค่ะ',
  },
  polite_m: {
    welcome: 'สวัสดีครับ ยินดีต้อนรับสู่ {shop} สนใจสินค้าตัวไหนกดสั่งได้เลยครับ',
    thanks: 'ได้รับเงินแล้วครับ ขอบคุณที่อุดหนุนนะครับ',
    booking: 'รับออเดอร์ #{order} เรียบร้อยแล้วครับ ร้านกำลังดำเนินการให้ เสร็จแล้วจะแจ้งในแชทนี้นะครับ',
    deliver: 'ร้านจัดส่งสินค้าให้แล้วครับ รบกวนตรวจสอบด้วยนะครับ',
    handoff: 'รับทราบครับ พิมพ์รายละเอียดทิ้งไว้ได้เลย แอดมินจะตอบกลับโดยเร็วที่สุดครับ',
  },
};

export type MenuKey = 'shop' | 'cart' | 'orders' | 'renew' | 'otp' | 'web' | 'admin';
export const MENU_ITEMS: Record<MenuKey, { label: string; icon: string; hint: string }> = {
  shop: { label: 'สั่งของเลย', icon: '🛍', hint: 'ดูสินค้า / สั่งซื้อในแชท' },
  cart: { label: 'ตะกร้า', icon: '🛒', hint: '' },
  orders: { label: 'ออเดอร์ของฉัน', icon: '📦', hint: '' },
  renew: { label: 'ต่อเมล', icon: '🔁', hint: 'ใช้ได้เมื่อมีลูกค้าต่อเมล' },
  otp: { label: 'ขอรหัส OTP', icon: '🔑', hint: 'เปิดหน้าค้นหา OTP ของร้าน (แพ็กเกจ Max)' },
  web: { label: 'เข้าเว็บร้าน', icon: '🌐', hint: 'เปิดเว็บร้าน' },
  admin: { label: 'คุยกับร้าน', icon: '💬', hint: 'แจ้งร้านทาง Discord' },
};

export type PushKey = 'slip_ok' | 'slip_bad' | 'deliver' | 'refund' | 'report';
export const PUSHES: { key: PushKey; label: string; hint: string }[] = [
  { key: 'slip_ok', label: 'ร้านอนุมัติสลิปเอง', hint: 'สลิปที่ระบบตรวจไม่ได้และร้านกดยืนยันเองทีหลัง แจ้งลูกค้าในแชททันที' },
  { key: 'slip_bad', label: 'ร้านปฏิเสธสลิป', hint: 'บอกเหตุผลและให้ลูกค้าส่งสลิปใหม่' },
  { key: 'deliver', label: 'ของที่จองมาแล้ว', hint: 'ร้านกดส่งของสินค้าสั่งทำ → แจ้งลูกค้า · ถ้าปิด ลูกค้าดูเองได้ที่ "ออเดอร์ของฉัน"' },
  { key: 'refund', label: 'คืนเงิน', hint: 'ร้านคืนเงินเข้ากระเป๋า → แจ้งลูกค้า' },
  { key: 'report', label: 'ร้านตอบเรื่องที่ลูกค้าแจ้งปัญหา', hint: 'ส่งข้อความตอบจากร้าน · ถ้าปิด ลูกค้าดูเองได้ที่หน้า "แจ้งปัญหา" บนเว็บ' },
];

export type BotConfig = {
  enabled: boolean;
  tone: Tone;
  messages: Partial<Record<MsgKey, string>>;
  menu: { key: MenuKey; on: boolean }[];
  card: { style: 'large' | 'compact'; sold: boolean; stock: boolean; logo: boolean };
  push: Record<PushKey, boolean>;
};

const MENU_DEFAULT: BotConfig['menu'] = [
  { key: 'shop', on: true }, { key: 'orders', on: true }, { key: 'cart', on: true }, { key: 'renew', on: true },
  { key: 'otp', on: false }, { key: 'web', on: true }, { key: 'admin', on: true },
];
export const DEFAULT_CONFIG: BotConfig = {
  enabled: true, tone: 'friendly', messages: {}, menu: MENU_DEFAULT,
  card: { style: 'large', sold: true, stock: false, logo: true },
  push: { slip_ok: true, slip_bad: true, deliver: true, refund: true, report: false },
};

/** ค่าจากฐานข้อมูล (อาจเก่า / ไม่ครบ) → ตั้งค่าครบทุกช่อง */
export function normalizeConfig(raw: unknown): BotConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<BotConfig>;
  const tone: Tone = r.tone === 'polite_f' || r.tone === 'polite_m' ? r.tone : 'friendly';
  const messages: BotConfig['messages'] = {};
  for (const m of MESSAGES) { const v = r.messages?.[m.key]; if (typeof v === 'string' && v.trim()) messages[m.key] = v.trim().slice(0, 500); }
  const seen = new Set<string>();
  const menu = (Array.isArray(r.menu) ? r.menu : []).filter((m): m is { key: MenuKey; on: boolean } => !!m && m.key in MENU_ITEMS && !seen.has(m.key) && !!seen.add(m.key)).map((m) => ({ key: m.key, on: m.on !== false }));
  for (const d of MENU_DEFAULT) if (!seen.has(d.key)) menu.push(d);   // ปุ่มใหม่ที่ร้านยังไม่เคยตั้ง → ต่อท้าย
  const c = (r.card ?? {}) as Partial<BotConfig['card']>;
  const p = (r.push ?? {}) as Partial<BotConfig['push']>;
  return {
    enabled: r.enabled !== false, tone, messages, menu,
    card: { style: c.style === 'compact' ? 'compact' : 'large', sold: c.sold !== false, stock: c.stock === true, logo: c.logo !== false },
    push: Object.fromEntries(PUSHES.map(({ key }) => [key, typeof p[key] === 'boolean' ? p[key] : DEFAULT_CONFIG.push[key]])) as BotConfig['push'],
  };
}

/** ข้อความของร้าน (ว่าง = ค่าเริ่มต้นตามน้ำเสียง) + แทนค่า {shop} {name} {order} {total} */
export function botText(cfg: BotConfig, key: MsgKey, vars: Partial<Record<'shop' | 'name' | 'order' | 'total', string>> = {}): string {
  const tpl = cfg.messages[key] || DEFAULT_MSG[cfg.tone][key];
  return tpl.replace(/\{(shop|name|order|total)\}/g, (_, k: string) => vars[k as keyof typeof vars] ?? '').replace(/\s{2,}/g, ' ').trim();
}

/** ลงท้ายข้อความระบบตามน้ำเสียง */
export const endWord = (cfg: BotConfig) => (cfg.tone === 'polite_m' ? 'ครับ' : cfg.tone === 'polite_f' ? 'ค่ะ' : 'ค่า');
