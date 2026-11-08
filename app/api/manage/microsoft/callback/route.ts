import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { requireAdmin } from '@/lib/api';
import { encrypt } from '@/lib/secret';
import { to } from '@/lib/routes';
import { MS_CALLBACK_PATH, checkState, exchangeCode, shopMsApp } from '@/lib/msgraph';
import { OTP_MAILBOX_MAX } from '@/lib/otp-search';

export const dynamic = 'force-dynamic';

const back = (code: string) => {
  const res = new NextResponse(null, { status: 303, headers: { Location: `${to('/admin/otp')}?ms=${code}` } });
  res.cookies.set('ms_nonce', '', { maxAge: 0, path: MS_CALLBACK_PATH });
  return res;
};

/** Microsoft ส่งกลับหลังล็อกอิน: ต้องเป็นแอดมินร้านเดิม และเบราว์เซอร์เดิมที่กดเชื่อม */
export async function GET(req: Request) {
  const a = await requireAdmin('otp');
  if ('res' in a) return new NextResponse(null, { status: 303, headers: { Location: to('/admin') } });
  if (!can(a.shop.plan, 'otp')) return back('plan');
  const url = new URL(req.url);
  if (url.searchParams.get('error')) return back('denied');
  const code = url.searchParams.get('code') ?? '', state = url.searchParams.get('state') ?? '';
  const nonce = checkState(a.shop.id, state);
  if (!code || !nonce || (await cookies()).get('ms_nonce')?.value !== nonce) return back('bad_state');
  const app = await shopMsApp(a.shop.id);
  if (!app) return back('missing');

  let tok: { refresh: string; email: string };
  try {
    tok = await exchangeCode(app, code, req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host);
  } catch (e) {
    console.error('[ms] token', (e as Error).message);
    return back('token');
  }
  if (!tok.refresh || !tok.email) return back('token');

  const d = db(), sid = a.shop.id;
  const { data: cur, error: se } = await d.from('shop_otp_mailboxes').select('id, provider').eq('shop_id', sid).eq('email', tok.email).maybeSingle();
  if (se) return back('sql');
  if (cur && cur.provider !== 'graph') return back('exists');
  if (!cur) {
    const { count } = await d.from('shop_otp_mailboxes').select('id', { count: 'exact', head: true }).eq('shop_id', sid);
    if ((count ?? 0) >= OTP_MAILBOX_MAX) return back('limit');
  }
  const row = { secret_enc: encrypt(tok.refresh), active: true, last_error: null };
  const { error } = cur
    ? await d.from('shop_otp_mailboxes').update(row).eq('id', cur.id)
    : await d.from('shop_otp_mailboxes').insert({ shop_id: sid, email: tok.email, provider: 'graph', ...row });
  if (error) { console.error('[ms] save', error.message); return back(error.code === '23514' ? 'sql' : 'save'); }
  return back('ok');
}
