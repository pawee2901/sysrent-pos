import 'server-only';

/**
 * แหล่งอีเมลจาก API ภายนอก (ยกมาจาก get_otp.php เดิม)
 * - Maily.space: อ่านกล่องเมลโดเมน Maily (@lico.moe / @rdcw.plus / @gooddaymail.com) ด้วย Bearer token ของร้าน
 */

export type SourceMail = { subject: string; from: string; date: Date; text: string; html: string; to: string[] };

export const MAILY_DOMAINS = ['lico.moe', 'rdcw.plus', 'gooddaymail.com'];
export const isMailyEmail = (email: string) => MAILY_DOMAINS.includes(email.split('@')[1]?.toLowerCase() ?? '');

const MAILY_API = 'https://api.maily.space/mail/public/mails';
const TIMEOUT_MS = 6_000;

// from/to ของ Maily อาจเป็นข้อความ, {name, address} หรือ array — อย่าเชื่อว่าเป็น string เสมอ
type MailyMail = { id?: string; from?: unknown; to?: unknown; subject?: string; html?: string; text?: string; createdAt?: unknown; timestamp?: unknown };

/** status = HTTP status (0 = ติดต่อไม่ได้/หมดเวลา) — ใช้บอกร้านว่า token ผิดหรือ API ล่ม */
async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<{ status: number; data: T | null; message: string }> {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    if (!r.ok) {
      const e = (await r.json().catch(() => null)) as { message?: unknown } | null;
      return { status: r.status, data: null, message: typeof e?.message === 'string' ? e.message.slice(0, 120) : '' };
    }
    return { status: r.status, data: (await r.json().catch(() => null)) as T | null, message: '' };
  } catch {
    return { status: 0, data: null, message: '' };
  }
}

/** token ที่ร้านวางมาพร้อมคำว่า "Bearer " → ตัดออก (ไม่งั้นส่งไปเป็น "Bearer Bearer ...") */
export const cleanToken = (t: string) => t.trim().replace(/^bearer\s+/i, '').trim();

function addrText(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(addrText).join(', ');
  if (typeof v === 'object') {
    const o = v as { text?: string; name?: string; address?: string; email?: string };
    return o.text ?? [o.name, o.address ?? o.email].filter(Boolean).join(' ');
  }
  return String(v);
}

/** เวลาของ Maily เป็น UTC — ISO ที่ไม่มี timezone ต้องอ่านเป็น UTC (แบบระบบเดิม) · ตัวเลข = epoch วินาที/มิลลิวินาที */
function parseMailyDate(v: unknown): Date {
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v);
  const s = String(v ?? '').trim();
  if (/^\d{9,}$/.test(s)) return parseMailyDate(Number(s));
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) return new Date(s.replace(' ', 'T') + 'Z');
  return new Date(s || 0);
}

/** PIN 6 หลักของกล่อง Maily (ตั้งในหน้า Mailbox ของ maily.space) — ส่งทาง header เดียวกับหน้าเว็บของ Maily */
const MAILY_PIN_HEADER = 'X-Mailbox-Pin';

/**
 * Maily API v1 (คีย์ sk_v1_... จาก maily.space/dashboard/api) — POST /v1/mails ส่ง apiKey + email ใน body
 * ต่างจาก API เดิม (/mail/public/mails + Bearer) ที่กล่องตั้ง PIN ไว้จะตอบ "กรุณาใส่ PIN"
 */
const MAILY_V1 = 'https://api.maily.space/v1/mails';
export const isMailyV1Key = (t: string) => /^sk_v\d+_/i.test(t);

async function mailyV1(email: string, apiKey: string, size: number): Promise<{ status: number; mails: MailyMail[] | null; message: string }> {
  try {
    const r = await fetch(MAILY_V1, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, email, size, page: 1 }),
      signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store',
    });
    const j = (await r.json().catch(() => null)) as { mails?: MailyMail[]; data?: { mails?: MailyMail[] }; message?: unknown } | null;
    const mails = j?.mails ?? j?.data?.mails;
    const message = typeof j?.message === 'string' ? j.message.slice(0, 120) : '';
    return { status: r.status, mails: r.ok && Array.isArray(mails) ? mails : null, message };
  } catch {
    return { status: 0, mails: null, message: '' };
  }
}

/**
 * อีเมลล่าสุดของกล่อง Maily (ลองทีละ token จนกว่าจะมีตัวที่ใช้ได้ — รองรับทั้งคีย์ sk_v1_ และ Bearer token แบบเดิม)
 * account = อีเมลที่ลูกค้ากรอก ใช้ตัดสินว่าเมลที่ส่งต่อ (forward) เข้ากล่องกลางเป็นของลูกค้าคนนี้หรือไม่
 */
export async function mailyRecent(boxEmail: string, tokens: string[], account: string, since: Date, pin = '', size = 15): Promise<SourceMail[]> {
  const [name, domain] = boxEmail.toLowerCase().split('@');
  if (!name || !domain || (tokens.length === 0 && !pin)) return [];
  const pinH: Record<string, string> = pin ? { [MAILY_PIN_HEADER]: pin } : {};
  const q = new URLSearchParams({ size: String(size), page: '1', accountName: name, domainId: domain.replace(/\./g, '') });

  let mails: MailyMail[] | null = null;
  let token = '';
  let status = 0;
  let why = '';
  // กล่องที่ตั้ง PIN ไว้: อ่านด้วย PIN อย่างเดียวได้ (ไม่ต้องมี token) — ลองก่อน แล้วค่อยลอง token ทีละตัว
  for (const t of pin ? ['', ...tokens] : tokens) {
    if (isMailyV1Key(t)) {
      const j = await mailyV1(boxEmail, t, size);
      status = j.status; why = j.message;
      if (j.mails) { mails = j.mails; break; }
      continue;
    }
    const j = await getJson<{ data?: { mails?: MailyMail[] } }>(`${MAILY_API}?${q}`, { ...pinH, ...(t ? { Authorization: `Bearer ${t}` } : {}) });
    status = j.status; why = j.message;
    if (Array.isArray(j.data?.data?.mails)) { mails = j.data.data.mails; token = t || '-'; break; }
  }
  // ไม่มี token ไหนอ่านกล่องนี้ได้ → แจ้งเป็น error (เดิมคืนว่างเงียบ ๆ ร้านเลยเห็นแค่ "ยังไม่พบรหัส")
  if (!mails) {
    throw new Error((status === 401 || status === 403
      ? `Maily ปฏิเสธ Token (HTTP ${status}) — Token ผิด/หมดอายุ หรือ Token นี้ไม่มีสิทธิ์อ่านกล่อง ${boxEmail}`
      : status ? `Maily ตอบกลับ HTTP ${status}` : 'ติดต่อ Maily ไม่ได้ (หมดเวลา)') + (why ? ` · Maily: ${why}` : ''));
  }

  const detailQ = new URLSearchParams({ accountName: name, domainId: domain.replace(/\./g, '') });
  const dated = mails.map((m) => ({ m, date: parseMailyDate(m.createdAt ?? m.timestamp) }));
  const recent = dated.filter((x) => x.date.getTime() >= since.getTime());
  return Promise.all(recent.map(async ({ m, date }) => {
    let html = typeof m.html === 'string' ? m.html : '';
    let text = typeof m.text === 'string' ? m.text : '';
    // รายการบางฉบับไม่มีเนื้อหา → ขอรายละเอียดเพิ่ม (เฉพาะ API เดิม — API v1 ส่งเนื้อหามาครบแล้ว)
    if (!html && !text && m.id && token) {
      const d = await getJson<{ data?: { html?: string; text?: string } }>(`${MAILY_API}/${encodeURIComponent(m.id)}?${detailQ}`, { ...pinH, ...(token !== '-' ? { Authorization: `Bearer ${token}` } : {}) });
      html = d.data?.data?.html ?? '';
      text = d.data?.data?.text ?? '';
    }
    const to: string[] = [...(addrText(m.to).toLowerCase().match(/[^\s<>,;"']+@[^\s<>,;"']+/g) ?? [])];
    // กล่องกลางที่รับเมล forward: ถ้าเนื้อหาเอ่ยถึงอีเมลลูกค้า ถือว่าเป็นของลูกค้าคนนี้ (แบบเดียวกับระบบเดิม)
    if (account && `${m.subject ?? ''} ${text} ${html}`.toLowerCase().includes(account)) to.push(account);
    return { subject: String(m.subject ?? ''), from: addrText(m.from), date, text, html, to };
  }));
}

/**
 * ชื่อเรียกอื่นของบริการ (โดเมนผู้ส่ง / ชื่อภาษาอื่น) — ร้านใส่ keywords แค่ชื่อแอปก็จับเมลได้
 * เช่น MangoTV ส่งจาก @mgtv.com หัวข้อภาษาจีน "芒果TV" ไม่มีคำว่า mangotv เลย
 */
const APP_ALIASES: [RegExp, string[]][] = [
  [/mango|芒果|mgtv/i, ['mgtv', '芒果', 'mango']],
  [/chatgpt|openai/i, ['openai', 'chatgpt']],
  [/netflix/i, ['netflix']],
  [/disney/i, ['disney']],
  [/prime|amazon/i, ['amazon', 'primevideo']],
  [/viu/i, ['viu']],
  [/iqiyi|爱奇艺/i, ['iqiyi', '爱奇艺']],
  [/wetv|tencent|腾讯/i, ['wetv', 'tencent', '腾讯']],
];

/**
 * keywords ของแอป → คำที่ต้องมี (รวมชื่อเรียกอื่น) + คำยกเว้น (ขึ้นต้นด้วย "-" เช่น -password = ข้ามเมลที่มีคำนี้)
 * ไม่มีคำที่ต้องมีเลย = ไม่กรอง (แบบเดิม)
 */
export function appKeywords(name: string, keywords: string): { include: string[]; exclude: string[] } {
  const words = (keywords ?? '').split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const include = words.filter((w) => !w.startsWith('-'));
  const exclude = words.filter((w) => w.startsWith('-') && w.length > 1).map((w) => w.slice(1));
  if (include.length) {
    for (const [re, alias] of APP_ALIASES) if (re.test(name) || include.some((w) => re.test(w))) include.push(...alias);
  }
  return { include: [...new Set(include)], exclude };
}

/** เมลเปลี่ยน/รีเซ็ตรหัสผ่าน — ChatGPT ให้ลูกค้าเห็นเฉพาะรหัสเข้าสู่ระบบ (กันคนเอารหัสไปเปลี่ยนรหัสผ่านบัญชี) */
export const PASSWORD_CHANGE_RE = /(reset|change|update|forgot|new)\s+(your\s+)?(openai\s+|chatgpt\s+)?password|password\s+(reset|change|update)|เปลี่ยนรหัสผ่าน|รีเซ็ตรหัสผ่าน|ตั้งรหัสผ่านใหม่|ลืมรหัสผ่าน/i;

// หัวข้อเมลรีเซ็ต/เปลี่ยนรหัส เช่น "รหัสชั่วคราวสำหรับรีเซ็ต…" — หัวข้อเมลเข้าสู่ระบบไม่มีคำพวกนี้ จับกว้างได้
const RESET_SUBJECT_RE = /reset|forgot|change\s+(your\s+)?password|รีเซ็ต|รีเซ็ท|รีเซต|เปลี่ยนรหัส|ลืมรหัส|ตั้งรหัสผ่านใหม่/i;

/**
 * เมลเปลี่ยน/รีเซ็ตรหัสผ่าน (ChatGPT ให้ลูกค้าเห็นแค่รหัสเข้าสู่ระบบ)
 * หัวข้อ: จับคำว่ารีเซ็ตแบบกว้าง · เนื้อหา: จับวลีเปลี่ยนรหัส แต่ไม่นับประโยคเตือน "If you didn't … reset your password" / "หากคุณไม่ได้ขอ…"
 */
export function isPasswordChangeMail(subject: string, text: string): boolean {
  if (RESET_SUBJECT_RE.test(subject)) return true;
  const main = text.replace(/(?:\bif\b|หาก|ถ้า)[^.!?。\n]*[.!?。\n]?/gi, ' ');
  return PASSWORD_CHANGE_RE.test(main);
}

/** รหัสแอปที่ Cloud Run (RDCW) ใช้ — ใช้ code ที่ร้านตั้งไว้ก่อน ถ้าไม่มีให้เดาจากชื่อ (แบบ get_app_code เดิม) */
export function cloudRunAppCode(code: string | null | undefined, name: string): string {
  // ใช้โค้ดที่ร้านตั้งไว้ก่อน (ถ้ามี) ไม่งั้นส่ง "ชื่อเต็มของแอป" ไปเลย กันดึงผิด
  // (เดิมเดาเป็น NF/DN/TM/PR และแอปใหม่ที่ไม่รู้จักจะ default เป็น GPT ทำให้ดึงผิดแอป)
  if (code?.trim()) return code.trim();
  return name.trim();
}

/** อนุญาตเฉพาะ https://*.run.app (กันร้านใส่ URL ภายในเครือข่ายให้เซิร์ฟเวอร์ไปเรียก — SSRF) */
export function cloudRunUrlOk(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' && /(^|\.)run\.app$/i.test(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** วันที่แบบ "02/06/2026 06:17" (UTC) ของ Cloud Run */
function parseCloudRunDate(s: string | undefined): Date {
  const m = (s ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5])) : new Date(s ?? 0);
}

export async function cloudRunRecent(url: string, account: string, appCode: string): Promise<SourceMail[]> {
  if (!cloudRunUrlOk(url)) return [];
  const u = new URL(url.trim());
  u.searchParams.set('senderEmail', account);
  u.searchParams.set('appCode', appCode);
  const j = await getJson<{ emails?: { html?: string; subject?: string; sender?: string; date?: string }[] }>(u.toString());
  if (!j.data) console.error('[mail] cloud run', u.hostname, j.status ? `HTTP ${j.status}` : 'timeout');
  return (j.data?.emails ?? []).map((m) => ({
    subject: m.subject ?? '', from: m.sender ?? '', date: parseCloudRunDate(m.date), text: '', html: m.html ?? '', to: [account],
  }));
}
