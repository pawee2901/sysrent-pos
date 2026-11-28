import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ACCESS_KINDS, PERIODS, accessProblem, normalizeAccess } from '@/lib/otp-agent';
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
  // ลูกค้าค้น OTP ที่ไหน: '' = ในเว็บร้าน · https://… = ลิงก์เว็บ OTP อื่น
  z.object({ action: z.literal('public_page'), on: z.boolean() }),
  // เว็บรับ OTP: ชื่อเว็บ + โลโก้ ('' = ใช้ของร้าน)
  z.object({ action: z.literal('site_brand'), name: z.string().trim().max(40), logo: z.string().trim().max(500).refine((v) => !v || /^https:\/\//.test(v), 'ลิงก์รูปต้องเป็น https') }),
  // ระบบตัวแทน: เปิด/ปิด · เพิ่ม / แก้ / ลบ รหัสยืนยันของแต่ละอีเมล
  z.object({ action: z.literal('agent_mode'), on: z.boolean() }),
  // ป๊อปอัปก่อนขอ OTP · คำขอ OTP เพิ่ม
  z.object({ action: z.literal('ack_config'), on: z.boolean(), text: z.string().trim().max(1000) }),
  z.object({ action: z.literal('ask_decide'), id, approve: z.boolean(), extra: z.number().int().min(1).max(20).default(1), reply: z.string().trim().max(500).default('') }),
  // จำกัดการรับรหัสของลูกค้า (ต่ออีเมล)
  z.object({ action: z.literal('cust_limit'), limit: z.number().int().min(0).max(1000), period: z.enum(['order', ...PERIODS]) }),
  z.object({ action: z.literal('access_add'), email: z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง').max(120), label: z.string().trim().max(40).default(''), kind: z.enum(ACCESS_KINDS), secret: z.string().trim().min(1, 'กรอกรหัส').max(120), use_limit: z.number().int().min(0).max(1000).default(0), period: z.enum(PERIODS).default('day') }),
  z.object({ action: z.literal('access_update'), id, active: z.boolean().optional(), use_limit: z.number().int().min(0).max(1000).optional(), period: z.enum(PERIODS).optional() }),
  z.object({ action: z.literal('access_delete'), id }),
  z.object({ action: z.literal('save_link'), link: z.string().trim().max(500).refine((v) => !v || /^https:\/\/[^\s]+$/.test(v), 'ลิงก์ต้องขึ้นต้นด้วย https://') }),
  z.object({ action: z.literal('add_api'), name: z.string().trim().min(1, 'ตั้งชื่ออ้างอิง').max(40), type: z.enum(['maily', 'cloud_run']), token: z.string().trim().min(8, 'กรอก Token หรือ URL').max(500) }),
  z.object({ action: z.literal('delete_api'), id }),
]);

const ASK_SQL = 'ต้องรัน SQL 0052_otp_ack_asks.sql ใน Supabase ก่อน';
const AGENT_SQL = 'ต้องรัน SQL 0049_otp_agent.sql ใน Supabase ก่อน';
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
  // ลบแค่ Microsoft App (ไม่ลบแถว — เก็บลิงก์เว็บ OTP ไว้)
  if (x.action === 'delete_ms') return done((await d.from('shop_otp_config').update({ ms_client_id: null, ms_secret_enc: null, updated_at: new Date().toISOString() }).eq('shop_id', sid)).error);
  if (x.action === 'cust_limit') {
    const { error } = await d.from('shop_otp_config').upsert({ shop_id: sid, cust_limit: x.limit, cust_period: x.period, updated_at: new Date().toISOString() });
    return error ? fail(/cust_|check constraint/.test(error.message) ? 'ต้องรัน SQL 0050_otp_customer_limit.sql และ 0053_otp_limit_per_order.sql ใน Supabase ก่อน' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (x.action === 'ack_config') {
    const { error } = await d.from('shop_otp_config').upsert({ shop_id: sid, ack_on: x.on, ack_text: x.text, updated_at: new Date().toISOString() });
    return error ? fail(/ack_/.test(error.message) ? ASK_SQL : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (x.action === 'ask_decide') {
    const { data, error } = await d.from('shop_otp_asks').update({ status: x.approve ? 'approved' : 'rejected', extra: x.approve ? x.extra : 0, reply: x.reply, decided_at: new Date().toISOString() })
      .eq('id', x.id).eq('shop_id', sid).eq('status', 'open').select('id');
    if (error) return fail(/shop_otp_asks/.test(error.message) ? ASK_SQL : 'บันทึกไม่สำเร็จ', 500);
    return data?.length ? NextResponse.json({ ok: true }) : fail('คำขอนี้ถูกจัดการไปแล้ว', 409);
  }
  if (x.action === 'agent_mode') {
    const { error } = await d.from('shop_otp_config').upsert({ shop_id: sid, agent_mode: x.on, updated_at: new Date().toISOString() });
    return error ? fail(/agent_mode/.test(error.message) ? AGENT_SQL : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (x.action === 'access_add') {
    const secret = normalizeAccess(x.kind, x.secret);
    const bad = accessProblem(x.kind, secret);
    if (bad) return fail(bad);
    const { error } = await d.from('shop_otp_access').insert({ shop_id: sid, email: x.email, label: x.label, kind: x.kind, secret, use_limit: x.use_limit, period: x.period });
    return error ? fail(error.code === '23505' ? 'อีเมลนี้มีรหัสนี้อยู่แล้ว' : /shop_otp_access/.test(error.message) ? AGENT_SQL : 'บันทึกไม่สำเร็จ', error.code === '23505' ? 409 : 500) : NextResponse.json({ ok: true });
  }
  if (x.action === 'access_update') {
    const upd: Record<string, unknown> = {};
    if (x.active !== undefined) upd.active = x.active;
    if (x.use_limit !== undefined) upd.use_limit = x.use_limit;
    if (x.period !== undefined) upd.period = x.period;
    return done((await d.from('shop_otp_access').update(upd).eq('id', x.id).eq('shop_id', sid)).error);
  }
  if (x.action === 'access_delete') return done((await d.from('shop_otp_access').delete().eq('id', x.id).eq('shop_id', sid)).error);
  if (x.action === 'site_brand') {
    const { error } = await d.from('shop_otp_config').upsert({ shop_id: sid, site_name: x.name, site_logo: x.logo, updated_at: new Date().toISOString() });
    return error ? fail(/site_/.test(error.message) ? 'ต้องรัน SQL 0054_otp_site_brand.sql ใน Supabase ก่อน' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (x.action === 'public_page') {
    const { error } = await d.from('shop_otp_config').upsert({ shop_id: sid, public_page: x.on, updated_at: new Date().toISOString() });
    return error ? fail(/public_page/.test(error.message) ? 'ต้องรัน SQL 0048_otp_public_page.sql ใน Supabase ก่อน' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (x.action === 'save_link') {
    const { error } = await d.from('shop_otp_config').upsert({ shop_id: sid, otp_link: x.link || null, updated_at: new Date().toISOString() });
    return error ? fail(/otp_link/.test(error.message) ? 'ต้องรัน SQL 0047_otp_link.sql ใน Supabase ก่อน' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }

  if (x.action === 'add_api') {
    if (x.type === 'cloud_run' && !cloudRunUrlOk(x.token)) return fail('Cloud Run ต้องเป็นลิงก์ https://....run.app เท่านั้น');
    const { count, error: ce } = await d.from('shop_otp_apis').select('id', { count: 'exact', head: true }).eq('shop_id', sid);
    if (ce) return fail(MISSING, 500);
    if ((count ?? 0) >= 20) return fail('เพิ่มได้สูงสุด 20 รายการ');
    return done((await d.from('shop_otp_apis').insert({ shop_id: sid, name: x.name, type: x.type, token_enc: encrypt(x.type === 'maily' ? cleanToken(x.token) : x.token) })).error);
  }
  return done((await d.from('shop_otp_apis').delete().eq('id', x.id).eq('shop_id', sid)).error);
}
