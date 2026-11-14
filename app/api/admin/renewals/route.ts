import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { encConfigured } from '@/lib/secret';
import { deleteShopLine, lineBotInfo, lineWebhookInfo, lineWebhookTest, pushLine, saveShopLine, shopLine } from '@/lib/line';
import { completePay, newLinkCode, renewAllowed, renewalFlex, type RenewalRow } from '@/lib/renewals';

const email = z.string().trim().toLowerCase().min(3, 'กรุณากรอกเมล').max(120);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ไม่ถูกต้อง');
const lineId = z.string().regex(/^U[0-9a-f]{32}$/).nullable();
const fields = {
  customer_email: email, fam_email: z.string().trim().toLowerCase().max(120).default(''),
  option_id: z.string().uuid('กรุณาเลือกแพ็กเกจ'), expires_on: day, line_user_id: lineId.default(null), note: z.string().trim().max(300).default(''),
};
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), ...fields }),
  z.object({ action: z.literal('update'), id: z.string().uuid(), ...fields }),
  z.object({ action: z.literal('removed'), id: z.string().uuid(), removed: z.boolean() }),
  z.object({ action: z.literal('status'), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
  z.object({ action: z.literal('remind'), id: z.string().uuid() }),
  z.object({ action: z.literal('confirm_pay'), id: z.string().uuid() }),
  z.object({
    action: z.literal('settings'),
    remind_days: z.number().int().min(1).max(30), grace_days: z.number().int().min(0).max(30),
    late_fee: z.number().min(0).max(10_000), removed_fee: z.number().min(0).max(10_000), fam_size: z.number().int().min(1).max(50),
  }),
  z.object({ action: z.literal('line_save'), secret: z.string().trim().regex(/^[0-9a-f]{32}$/i, 'Channel secret ต้องเป็นตัวอักษร 32 ตัว (0-9 a-f)'), token: z.string().trim().min(100, 'Channel access token สั้นเกินไป — คัดลอกให้ครบ').max(400) }),
  z.object({ action: z.literal('line_test') }),
  z.object({ action: z.literal('line_delete') }),
]);

/** ต่อเมล (หลังบ้าน): ลูกค้า · ตั้งค่า · เชื่อม LINE OA ของร้าน */
export async function POST(req: Request) {
  const a = await requireAdmin('renewals');
  if ('res' in a) return a.res;
  if (!renewAllowed(a.shop.plan)) return fail('ต่อเมลผ่าน LINE ใช้ได้ในแพ็กเกจ Pro ขึ้นไป', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), x = b.data, sid = a.shop.id;
  const ok = (notice?: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: true, notice, ...extra });
  const missing = (e: { code?: string; message?: string } | null) => e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42703' || e.code === 'PGRST204');

  if (x.action === 'create') {
    const { action: _a, ...row } = x;
    for (let i = 0; i < 5; i++) {   // รหัสผูกแชทสุ่ม — ชนกัน (หายาก) ลองใหม่
      const { data, error } = await d.from('shop_renewals').insert({ ...row, shop_id: sid, link_code: newLinkCode() }).select('link_code').single();
      if (!error) return ok(row.line_user_id ? 'เพิ่มแล้ว · ผูกแชท LINE แล้ว ระบบจะเตือนเอง' : `เพิ่มแล้ว · ส่งรหัส ${data.link_code} ให้ลูกค้าพิมพ์ใน LINE ร้าน`, { code: data.link_code });
      if (missing(error)) return fail('ยังไม่ได้รัน 0028_shop_renewals.sql ใน Supabase', 400);
      if (error.code !== '23505') { console.error('[renewals] create', error.message); return fail('บันทึกไม่สำเร็จ', 500); }
    }
    return fail('สร้างรหัสไม่สำเร็จ กรุณาลองใหม่', 500);
  }
  if (x.action === 'update') {
    const { action: _a, id, ...row } = x;
    const { data: cur } = await d.from('shop_renewals').select('expires_on').eq('id', id).eq('shop_id', sid).maybeSingle();
    if (!cur) return fail('ไม่พบรายการ', 404);
    // เปลี่ยนวันหมดอายุ = รอบใหม่ เตือนใหม่ได้
    const reset = cur.expires_on !== row.expires_on ? { reminded_for: null, lapsed_for: null } : {};
    const { error } = await d.from('shop_renewals').update({ ...row, ...reset, updated_at: new Date().toISOString() }).eq('id', id).eq('shop_id', sid);
    return error ? fail('บันทึกไม่สำเร็จ', 500) : ok('บันทึกแล้ว');
  }
  if (x.action === 'removed') {
    const { data } = await d.from('shop_renewals').update({ removed_at: x.removed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', x.id).eq('shop_id', sid).select('id');
    return data?.length ? ok(x.removed ? 'บันทึกว่าลบเมลแล้ว — ลูกค้ามาต่อจะคิดค่าเพิ่ม และแจ้งให้เพิ่มเมลกลับ' : 'กลับเป็นยังอยู่ใน fam') : fail('ไม่พบรายการ', 404);
  }
  if (x.action === 'status') {
    const { data } = await d.from('shop_renewals').update({ status: x.active ? 'active' : 'cancelled', updated_at: new Date().toISOString() }).eq('id', x.id).eq('shop_id', sid).select('id');
    return data?.length ? ok(x.active ? 'กลับมาต่อแล้ว' : 'เลิกต่อแล้ว ระบบจะไม่เตือนอีก') : fail('ไม่พบรายการ', 404);
  }
  if (x.action === 'delete') {
    await d.from('shop_renewals').delete().eq('id', x.id).eq('shop_id', sid);
    return ok('ลบแล้ว');
  }
  if (x.action === 'remind') {
    const { data } = await d.from('shop_renewals').select('*').eq('id', x.id).eq('shop_id', sid).maybeSingle();
    const r = data as RenewalRow | null;
    if (!r) return fail('ไม่พบรายการ', 404);
    if (!r.line_user_id) return fail(`ยังไม่ผูกแชท — ส่งรหัส ${r.link_code} ให้ลูกค้าพิมพ์ใน LINE ร้านก่อน`);
    const line = await shopLine(sid);
    if (!line) return fail('ร้านยังไม่ได้เชื่อม LINE OA');
    if (!(await pushLine(line.token, r.line_user_id, [await renewalFlex(r)]))) return fail('ส่งไม่สำเร็จ — ลูกค้าอาจบล็อก LINE ร้าน หรือโควตาข้อความ LINE ของร้านหมด');
    await d.from('shop_renewals').update({ reminded_for: r.expires_on }).eq('id', r.id);
    return ok('ส่งเตือนเข้า LINE ลูกค้าแล้ว');
  }
  if (x.action === 'confirm_pay') {
    // ไม่มีบริการตรวจสลิป / โควตาหมด → แอดมินเห็นเงินเข้าแล้ว กดยืนยันเอง
    const { data: p } = await d.from('shop_renewal_pays').select('id, line_user_id, status').eq('id', x.id).eq('shop_id', sid).maybeSingle();
    if (!p) return fail('ไม่พบรายการ', 404);
    if (p.status === 'paid') return fail('รายการนี้ยืนยันไปแล้ว', 409);
    const msg = await completePay(a.shop, p.id, `manual-${p.id}`, { manual: true, at: new Date().toISOString() }, 'แอดมินยืนยัน');
    if (!msg.startsWith('✅')) return fail(msg.replace(/^❌\s*/, ''));
    const line = await shopLine(sid);
    if (line) await pushLine(line.token, p.line_user_id, [{ type: 'text', text: msg }]);
    return ok('ยืนยันรับเงินแล้ว ต่ออายุให้ลูกค้าแล้ว');
  }
  if (x.action === 'settings') {
    const { error } = await d.from('shops').update({
      renew_remind_days: x.remind_days, renew_grace_days: x.grace_days, renew_late_fee: x.late_fee, renew_removed_fee: x.removed_fee, renew_fam_size: x.fam_size,
    }).eq('id', sid);
    if (missing(error)) return fail('ยังไม่ได้รัน 0028_shop_renewals.sql ใน Supabase', 400);
    return error ? fail('บันทึกไม่สำเร็จ', 500) : ok('บันทึกการตั้งค่าแล้ว');
  }
  if (x.action === 'line_save') {
    if (!encConfigured()) return fail('ระบบยังไม่ได้ตั้ง ENC_KEY — แจ้งผู้ดูแล SysRent', 500);
    const info = await lineBotInfo(x.token);
    if (!info) return fail('Channel access token ใช้ไม่ได้ — ตรวจว่าคัดลอกมาครบ และเป็นของช่อง Messaging API');
    const { error } = await saveShopLine(sid, x.secret.toLowerCase(), x.token, info);
    if (missing(error)) return fail('ยังไม่ได้รัน 0028_shop_renewals.sql ใน Supabase', 400);
    if (error) return fail('บันทึกไม่สำเร็จ', 500);
    return ok(`เชื่อม LINE "${info.botName}" (${info.basicId}) แล้ว — ตั้ง Webhook URL ใน LINE ต่อ แล้วกด "ทดสอบการเชื่อมต่อ"`);
  }
  if (x.action === 'line_test') {
    const line = await shopLine(sid);
    if (!line) return fail('ยังไม่ได้เชื่อม LINE OA');
    const root = process.env.SHOP_ROOT_DOMAIN || 'sysrent.shop';
    const want = `https://${a.shop.slug}.${root}/api/line/webhook`;
    const wh = await lineWebhookInfo(line.token);
    if (!wh) return fail('ติดต่อ LINE ไม่ได้ — token อาจหมดอายุ ลองเชื่อมใหม่');
    if (wh.endpoint !== want) return fail(`Webhook URL ใน LINE ยังไม่ถูก ต้องเป็น ${want}`);
    if (!wh.active) return fail('ยังไม่ได้เปิด "Use webhook" ใน LINE Developers / LINE OA Manager');
    const t = await lineWebhookTest(line.token);
    if (!t?.success) return fail(t?.statusCode === 401 ? 'Channel secret ไม่ตรงกับช่องนี้ — ตรวจแล้วเชื่อมใหม่' : `LINE ส่งเข้าเว็บร้านไม่สำเร็จ (${t?.statusCode ?? '-'} ${t?.reason ?? ''})`);
    return ok('✅ เชื่อมต่อสมบูรณ์ — LINE ส่งข้อความเข้าร้านได้แล้ว');
  }
  await deleteShopLine(sid);
  return ok('ยกเลิกการเชื่อม LINE แล้ว');
}
