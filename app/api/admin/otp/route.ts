import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { body, fail, requireAdmin } from '@/lib/api';
import { encConfigured, encrypt } from '@/lib/secret';
import { cleanToken, cloudRunUrlOk } from '@/lib/otp-sources';
import { OTP_MAILBOX_MAX, shopOtpApis, testMailbox } from '@/lib/otp-search';

export const maxDuration = 30;

const id = z.string().uuid();
const pin = z.string().regex(/^(\d{6})?$/, 'PIN ต้องเป็นตัวเลข 6 หลัก');
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_gmail'), email: z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง').max(120), password: z.string().trim().min(16, 'App Password ต้องมี 16 ตัว').max(40) }),
  z.object({ action: z.literal('add_maily'), email: z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง').max(120), pin: pin.default('') }),
  z.object({ action: z.literal('maily_pin'), id, pin }),
  z.object({ action: z.literal('toggle_box'), id, active: z.boolean() }),
  z.object({ action: z.literal('delete_box'), id }),
  z.object({ action: z.literal('add_app'), name: z.string().trim().min(1, 'กรอกชื่อแอป').max(40), keywords: z.string().trim().min(1, 'กรอกคำค้น').max(200), code: z.string().trim().max(40).default('') }),
  z.object({ action: z.literal('delete_app'), id }),
  z.object({ action: z.literal('save_ms'), client_id: z.string().trim().regex(/^[0-9a-f-]{36}$/i, 'Client ID ต้องเป็นรูปแบบ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'), client_secret: z.string().trim().max(200).default('') }),
  z.object({ action: z.literal('delete_ms') }),
  z.object({ action: z.literal('add_api'), name: z.string().trim().min(1, 'ตั้งชื่ออ้างอิง').max(40), type: z.enum(['maily', 'cloud_run']), token: z.string().trim().min(8, 'กรอก Token หรือ URL').max(500) }),
  z.object({ action: z.literal('delete_api'), id }),
]);

const MISSING = 'ต้องรัน SQL 0024, 0025 และ 0026 ใน Supabase ก่อน';

/** ตั้งค่าค้นหา OTP · รหัส / Token / Secret เข้ารหัสก่อนเก็บ และไม่ส่งกลับหน้าเว็บ */
export async function POST(req: Request) {
  const a = await requireAdmin('otp');
  if ('res' in a) return a.res;
  if (!can(a.shop.plan, 'otp')) return fail('ค้นหา OTP อยู่ในแพ็กเกจ Max', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), x = b.data, sid = a.shop.id;
  if (!encConfigured()) return fail('ระบบยังไม่ได้ตั้ง ENC_KEY', 503);
  const done = (error: { message: string; code?: string } | null, dup = '') => error
    ? fail(error.code === '23505' ? dup : /shop_otp|code/.test(error.message) ? MISSING : 'บันทึกไม่สำเร็จ', error.code === '23505' ? 409 : 500)
    : NextResponse.json({ ok: true });

  if (x.action === 'add_gmail' || x.action === 'add_maily') {
    const { count, error: ce } = await d.from('shop_otp_mailboxes').select('id', { count: 'exact', head: true }).eq('shop_id', sid);
    if (ce) return fail(MISSING, 500);
    if ((count ?? 0) >= OTP_MAILBOX_MAX) return fail(`เพิ่มกล่องได้สูงสุด ${OTP_MAILBOX_MAX} กล่อง`);
    const provider = x.action === 'add_gmail' ? 'gmail' as const : 'maily' as const;
    const secret = x.action === 'add_gmail' ? x.password.replace(/\s+/g, '') : x.pin;
    let tokens: string[] = [];
    if (provider === 'maily') {
      tokens = (await shopOtpApis(sid)).mailyTokens;
      if (!secret && !tokens.length) return fail('ใส่ Token ในแท็บตั้งค่า API ก่อน หรือกรอก PIN ของกล่อง');
    }
    const why = await testMailbox(provider, x.email, secret, tokens);
    if (why) return fail(why);
    return done((await d.from('shop_otp_mailboxes').insert({ shop_id: sid, provider, email: x.email, secret_enc: encrypt(secret) })).error, 'มีกล่องอีเมลนี้อยู่แล้ว');
  }
  if (x.action === 'maily_pin') return done((await d.from('shop_otp_mailboxes').update({ secret_enc: encrypt(x.pin), last_error: null }).eq('id', x.id).eq('shop_id', sid).eq('provider', 'maily')).error);
  if (x.action === 'toggle_box') return done((await d.from('shop_otp_mailboxes').update({ active: x.active }).eq('id', x.id).eq('shop_id', sid)).error);
  if (x.action === 'delete_box') return done((await d.from('shop_otp_mailboxes').delete().eq('id', x.id).eq('shop_id', sid)).error);
  if (x.action === 'add_app') return done((await d.from('shop_otp_apps').insert({ shop_id: sid, name: x.name, keywords: x.keywords.toLowerCase(), code: x.code })).error, 'มีแอปนี้อยู่แล้ว');
  if (x.action === 'delete_app') return done((await d.from('shop_otp_apps').delete().eq('id', x.id).eq('shop_id', sid)).error);

  if (x.action === 'save_ms') {
    const row: Record<string, string> = { shop_id: sid, ms_client_id: x.client_id, updated_at: new Date().toISOString() };
    if (x.client_secret) row.ms_secret_enc = encrypt(x.client_secret);
    else {
      const { data } = await d.from('shop_otp_config').select('ms_secret_enc').eq('shop_id', sid).maybeSingle();
      if (!data?.ms_secret_enc) return fail('กรุณากรอก Client Secret');
    }
    return done((await d.from('shop_otp_config').upsert(row)).error);
  }
  if (x.action === 'delete_ms') return done((await d.from('shop_otp_config').delete().eq('shop_id', sid)).error);

  if (x.action === 'add_api') {
    if (x.type === 'cloud_run' && !cloudRunUrlOk(x.token)) return fail('Cloud Run ต้องเป็นลิงก์ https://....run.app เท่านั้น');
    const { count, error: ce } = await d.from('shop_otp_apis').select('id', { count: 'exact', head: true }).eq('shop_id', sid);
    if (ce) return fail(MISSING, 500);
    if ((count ?? 0) >= 20) return fail('เพิ่มได้สูงสุด 20 รายการ');
    return done((await d.from('shop_otp_apis').insert({ shop_id: sid, name: x.name, type: x.type, token_enc: encrypt(x.type === 'maily' ? cleanToken(x.token) : x.token) })).error);
  }
  return done((await d.from('shop_otp_apis').delete().eq('id', x.id).eq('shop_id', sid)).error);
}
