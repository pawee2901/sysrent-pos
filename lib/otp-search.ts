import 'server-only';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/secret';
import { extractOtp } from '@/lib/otp-extract';
import { graphRecent, shopMsApp } from '@/lib/msgraph';
import { appKeywords, cleanToken, cloudRunAppCode, cloudRunRecent, cloudRunUrlOk, isMailyEmail, isPasswordChangeMail, mailyRecent, type SourceMail } from '@/lib/otp-sources';

export const OTP_MAILBOX_MAX = 10;
export type OtpHit = { code: string | null; link: string | null; subject: string; from: string; date: string };
export class OtpMailboxError extends Error {}

type Box = { id: string; email: string; provider: 'gmail' | 'maily' | 'graph'; secret_enc: string };
type Src = 'box' | 'maily' | 'cloud';

const GMAIL_HOST = 'imap.gmail.com';
const MAX_AGE_MS = 15 * 60_000;
const SCAN_RECENT = 10;
const RETURN_MAX = 3;

const gmailClient = (email: string, pass: string) => new ImapFlow({ host: GMAIL_HOST, port: 993, secure: true, auth: { user: email, pass }, logger: false, socketTimeout: 30_000 });
const plain = (html: string) => html.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&');
const safeDecrypt = (v: string) => { try { return v ? decrypt(v) : ''; } catch { return ''; } };

/** กล่อง Maily เก็บ PIN 6 หลัก (หรือ Token เดิม) · Token ของร้านอยู่ในแท็บตั้งค่า API */
function mailyCred(secret: string, shopTokens: string[]) {
  const pin = /^\d{6}$/.test(secret) ? secret : '';
  return { pin, tokens: secret && !pin ? [cleanToken(secret), ...shopTokens] : shopTokens };
}

/** Token / URL ที่ร้านกรอกไว้ */
export async function shopOtpApis(shopId: string): Promise<{ mailyTokens: string[]; cloudUrls: string[] }> {
  const { data } = await db().from('shop_otp_apis').select('type, token_enc').eq('shop_id', shopId);
  const rows = (data ?? []).map((a) => ({ type: a.type as string, value: safeDecrypt(a.token_enc as string) })).filter((a) => a.value);
  return {
    mailyTokens: rows.filter((a) => a.type === 'maily').map((a) => cleanToken(a.value)).filter(Boolean),
    cloudUrls: rows.filter((a) => a.type === 'cloud_run' && cloudRunUrlOk(a.value)).map((a) => a.value.trim()),
  };
}

/** ตรวจว่าใช้เข้ากล่องได้จริงก่อนบันทึก */
export async function testMailbox(provider: 'gmail' | 'maily', email: string, secret: string, shopTokens: string[] = []): Promise<string | null> {
  try {
    if (provider === 'gmail') {
      const c = gmailClient(email, secret);
      c.on('error', () => {});
      await c.connect();
      await c.logout();
    } else {
      const { tokens, pin } = mailyCred(secret, shopTokens);
      await mailyRecent(email, tokens, email, new Date(), pin, 1);
    }
    return null;
  } catch (e) {
    return provider === 'gmail' ? 'เข้า Gmail ไม่ได้ ตรวจอีเมลกับ App Password และการเปิดใช้ IMAP' : (e as Error).message.slice(0, 200);
  }
}

async function scanGmail(box: Box, since: Date, keep: (from: string, subject: string, to: string[]) => boolean): Promise<SourceMail[]> {
  const client = gmailClient(box.email, decrypt(box.secret_enc));
  client.on('error', () => {});
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const found = (await client.search({ since }, { uid: true })) || [];
      const pick = found.slice(-SCAN_RECENT);
      if (!pick.length) return [];
      const want: number[] = [];
      for await (const m of client.fetch(pick.join(','), { envelope: true }, { uid: true })) {
        const e = m.envelope;
        const from = (e?.from ?? []).map((a) => `${a.name ?? ''} <${a.address ?? ''}>`).join(', ');
        const to = [...(e?.to ?? []), ...(e?.cc ?? [])].map((a) => (a.address ?? '').toLowerCase()).filter(Boolean);
        if (keep(from, e?.subject ?? '', to)) want.push(m.uid);
      }
      if (!want.length) return [];
      const out: SourceMail[] = [];
      for await (const m of client.fetch(want.join(','), { source: true }, { uid: true })) {
        if (!m.source) continue;
        const p = await simpleParser(m.source);
        const heads = [p.to, p.cc].flatMap((f) => (Array.isArray(f) ? f : f ? [f] : []));
        out.push({
          subject: p.subject ?? '', from: p.from?.text ?? '', date: p.date ?? new Date(0), text: p.text ?? '', html: typeof p.html === 'string' ? p.html : '',
          to: heads.flatMap((h) => h.value.map((v) => (v.address ?? '').toLowerCase())).filter(Boolean),
        });
      }
      return out;
    } finally { lock.release(); }
  } finally { await client.logout().catch(() => client.close()); }
}

/** อีเมล OTP ล่าสุดภายใน 15 นาทีของอีเมลบัญชีนี้ · ไม่แสดงเมลรีเซ็ตรหัสผ่าน และไม่ส่งเนื้อหาเมลเต็มให้หน้าเว็บ */
export async function searchOtp(opts: { shopId: string; account: string; appName: string; keywords: string; appCode: string }): Promise<OtpHit[]> {
  const d = db();
  const { data } = await d.from('shop_otp_mailboxes').select('id, email, provider, secret_enc').eq('shop_id', opts.shopId).eq('active', true).order('created_at').limit(OTP_MAILBOX_MAX);
  const all = (data ?? []) as Box[];
  const { mailyTokens, cloudUrls } = await shopOtpApis(opts.shopId);
  const account = opts.account.toLowerCase();
  const own = all.filter((b) => b.email.toLowerCase() === account);
  const list = own.length ? own : [...all];
  // อีเมลโดเมน Maily ที่ไม่ได้เพิ่มเป็นกล่อง แต่ร้านมี Token → อ่านกล่องนั้นตรง ๆ
  if (!own.length && isMailyEmail(account) && mailyTokens.length) list.push({ id: '', email: account, provider: 'maily', secret_enc: '' });
  const useCloud = cloudUrls.length > 0 && !own.length && !account.endsWith('@gmail.com') && !isMailyEmail(account);
  if (!list.length && !useCloud) return [];

  const { include, exclude } = appKeywords(opts.appName, opts.keywords);
  const since = new Date(Date.now() - MAX_AGE_MS);
  const hits: OtpHit[] = [];
  const failed: string[] = [];
  const ms = list.some((b) => b.provider === 'graph') ? await shopMsApp(opts.shopId) : null;
  const matches = (hay: string) => !include.length || include.some((k) => hay.includes(k));
  const mine = (email: string, to: string[]) => email.toLowerCase() === account || to.some((t) => t.includes(account));

  const consider = (email: string, m: SourceMail, src: Src) => {
    if (m.date.getTime() < since.getTime() || !mine(email, m.to)) return;
    const from = m.from.toLowerCase(), text = m.text || plain(m.html);
    if (src !== 'cloud' && !matches(`${from} ${m.subject} ${src === 'maily' ? text : ''}`.toLowerCase())) return;
    const hay = `${from} ${m.subject} ${text}`.toLowerCase();
    if (exclude.some((w) => hay.includes(w)) || isPasswordChangeMail(m.subject, text)) return;
    const ex = extractOtp(m.subject, m.text, m.html);
    if (!ex.code && !ex.link) return;
    hits.push({ code: ex.code, link: ex.link && /^https:\/\//i.test(ex.link) ? ex.link : null, subject: m.subject.slice(0, 200), from: m.from.slice(0, 120), date: m.date.toISOString() });
  };

  const jobs = list.map(async (box) => {
    const mark = (last_error: string | null) => (box.id ? d.from('shop_otp_mailboxes').update({ last_error }).eq('id', box.id) : Promise.resolve());
    try {
      if (box.provider === 'gmail') {
        (await scanGmail(box, since, (from, subject, to) => mine(box.email, to) && matches(`${from} ${subject}`.toLowerCase()))).forEach((m) => consider(box.email, m, 'box'));
      } else if (box.provider === 'graph') {
        if (!ms) throw new Error('ยังไม่ได้ตั้ง Microsoft App ในแท็บตั้งค่า API');
        (await graphRecent(box, ms, SCAN_RECENT)).forEach((m) => consider(box.email, m, 'box'));
      } else {
        const c = mailyCred(safeDecrypt(box.secret_enc), mailyTokens);
        (await mailyRecent(box.email, c.tokens, account, since, c.pin)).forEach((m) => consider(box.email, m, 'maily'));
      }
      await mark(null);
    } catch (e) {
      const msg = (e as Error).message.slice(0, 200);
      console.error('[otp] mailbox failed', box.id || 'direct', msg);
      failed.push(box.id || box.email);
      await mark(msg);
    }
  });
  if (useCloud) {
    jobs.push(...cloudUrls.map(async (url) => {
      try {
        (await cloudRunRecent(url, account, cloudRunAppCode(opts.appCode, opts.appName))).forEach((m) => consider(account, m, 'cloud'));
      } catch (e) { console.error('[otp] cloud run failed', (e as Error).message); }
    }));
  }
  await Promise.all(jobs);

  if (!hits.length && list.length && failed.length === list.length && !useCloud) throw new OtpMailboxError('all mailboxes failed');
  return hits.sort((a, b) => b.date.localeCompare(a.date)).slice(0, RETURN_MAX);
}
