import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/secret';

/**
 * Hotmail / Outlook ผ่าน Microsoft Graph (บัญชีส่วนตัว)
 * แต่ละร้านสร้าง Microsoft App ของตัวเอง แล้วกรอกในหลังบ้าน · Redirect URI = โดเมนของร้าน
 */
const AUTH_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const SCOPE = 'offline_access Mail.Read openid profile email';

export const MS_CALLBACK_PATH = '/api/manage/microsoft/callback';
export type MsApp = { clientId: string; clientSecret: string };

/** Microsoft App ที่ร้านกรอกไว้ · ถอดรหัสไม่ได้หรือยังไม่ตั้ง = null */
export async function shopMsApp(shopId: string): Promise<MsApp | null> {
  const { data } = await db().from('shop_otp_config').select('ms_client_id, ms_secret_enc').eq('shop_id', shopId).maybeSingle();
  if (!data?.ms_client_id || !data.ms_secret_enc) return null;
  try { return { clientId: data.ms_client_id as string, clientSecret: decrypt(data.ms_secret_enc as string) }; } catch { return null; }
}

const scheme = (host: string) => (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');
export const redirectUri = (host: string) => `${scheme(host)}://${host}${MS_CALLBACK_PATH}`;

const stateKey = () => createHash('sha256').update(`ms-state:${process.env.ENC_KEY ?? ''}`).digest();
const sign = (shopId: string, nonce: string) => createHmac('sha256', stateKey()).update(`${shopId}.${nonce}`).digest('hex');

/** state = nonce.sig · ผูกกับร้าน และ nonce ผูกกับเบราว์เซอร์ผ่าน cookie */
export function makeState(shopId: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString('hex');
  return { state: `${nonce}.${sign(shopId, nonce)}`, nonce };
}
export function checkState(shopId: string, state: string): string | null {
  const [nonce, sig] = state.split('.');
  if (!nonce || !sig || (process.env.ENC_KEY ?? '').length < 32) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(shopId, nonce));
  return a.length === b.length && timingSafeEqual(a, b) ? nonce : null;
}

export function authorizeUrl(clientId: string, host: string, state: string, loginHint?: string): string {
  const q = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: redirectUri(host), response_mode: 'query', scope: SCOPE, state, prompt: 'select_account',
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `${AUTH_URL}?${q}`;
}

type TokenRes = { access_token?: string; refresh_token?: string; id_token?: string; error_description?: string };

async function tokenCall(body: Record<string, string>): Promise<TokenRes> {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...body, scope: SCOPE }), signal: AbortSignal.timeout(10_000) });
  const j = (await r.json().catch(() => ({}))) as TokenRes;
  if (!r.ok) throw new Error(j.error_description?.split('\r\n')[0] ?? `HTTP ${r.status}`);
  return j;
}

export async function exchangeCode(app: MsApp, code: string, host: string): Promise<{ refresh: string; email: string }> {
  const t = await tokenCall({ client_id: app.clientId, client_secret: app.clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri(host) });
  let email = '';
  try {
    const p = JSON.parse(Buffer.from((t.id_token ?? '').split('.')[1] ?? '', 'base64url').toString('utf8'));
    email = String(p.email || p.preferred_username || '').toLowerCase();
  } catch { /* ไม่มี id_token */ }
  return { refresh: t.refresh_token ?? '', email };
}

const tokens = new Map<string, { access: string; exp: number }>();

async function accessToken(box: { id: string; secret_enc: string }, app: MsApp): Promise<string> {
  const cached = tokens.get(box.id);
  if (cached && cached.exp > Date.now()) return cached.access;
  const t = await tokenCall({ client_id: app.clientId, client_secret: app.clientSecret, refresh_token: decrypt(box.secret_enc), grant_type: 'refresh_token' });
  if (!t.access_token) throw new Error('การเชื่อมต่อหมดอายุ กรุณาเชื่อมใหม่');
  if (t.refresh_token) await db().from('shop_otp_mailboxes').update({ secret_enc: encrypt(t.refresh_token) }).eq('id', box.id);
  tokens.set(box.id, { access: t.access_token, exp: Date.now() + 50 * 60_000 });
  return t.access_token;
}

type Addr = { emailAddress?: { address?: string; name?: string } };
type Msg = { subject?: string; from?: Addr; receivedDateTime?: string; body?: { content?: string; contentType?: string }; toRecipients?: Addr[]; ccRecipients?: Addr[] };

export async function graphRecent(box: { id: string; secret_enc: string }, app: MsApp, top = 10) {
  const tok = await accessToken(box, app);
  const q = new URLSearchParams({ $top: String(top), $orderby: 'receivedDateTime desc', $select: 'subject,from,receivedDateTime,body,toRecipients,ccRecipients' });
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/messages?${q}`, { headers: { Authorization: `Bearer ${tok}` }, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
  if (r.status === 401) tokens.delete(box.id);
  if (!r.ok) throw new Error(`Microsoft ตอบกลับ HTTP ${r.status}`);
  const j = (await r.json()) as { value?: Msg[] };
  return (j.value ?? []).map((m) => {
    const fa = m.from?.emailAddress, body = m.body?.content ?? '';
    return {
      subject: m.subject ?? '', from: fa ? `${fa.name ?? ''} <${fa.address ?? ''}>` : '', date: new Date(m.receivedDateTime ?? 0),
      text: m.body?.contentType === 'text' ? body : '', html: m.body?.contentType === 'text' ? '' : body,
      to: [...(m.toRecipients ?? []), ...(m.ccRecipients ?? [])].map((a) => (a.emailAddress?.address ?? '').toLowerCase()).filter(Boolean),
    };
  });
}
