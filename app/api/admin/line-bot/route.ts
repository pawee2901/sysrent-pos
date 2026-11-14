import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { can } from '@/lib/plan';
import { encConfigured } from '@/lib/secret';
import { deleteShopLine, lineBotInfo, lineSetWebhook, lineWebhookInfo, lineWebhookTest, saveShopLine, shopLine } from '@/lib/line';
import { normalizeConfig } from '@/lib/line-bot-config';
import { forgetBotConfig } from '@/lib/line-shop';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('config'), config: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal('sell'), on: z.boolean() }),
  z.object({ action: z.literal('line_save'), secret: z.string().trim().regex(/^[0-9a-f]{32}$/i, 'Channel secret ต้องเป็นตัวอักษร 32 ตัว (0-9 a-f)'), token: z.string().trim().min(100, 'Channel access token สั้นเกินไป — คัดลอกให้ครบ').max(400) }),
  z.object({ action: z.literal('line_test') }),
  z.object({ action: z.literal('line_delete') }),
]);

/** หลังบ้าน → บอท LINE: เชื่อม LINE OA · ตั้งค่าหน้าตา / ข้อความ / เมนู / การ์ด / ข้อความที่เสียโควตา */
export async function POST(req: Request) {
  const a = await requireAdmin('linebot');
  if ('res' in a) return a.res;
  if (!can(a.shop.plan, 'line_shop') && !can(a.shop.plan, 'renewals')) return fail('บอท LINE ใช้ได้ในแพ็กเกจ Pro ขึ้นไป', 403);
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), x = b.data, sid = a.shop.id;
  const ok = (notice: string) => NextResponse.json({ ok: true, notice });
  const missing = (e: { code?: string } | null) => e && ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e.code ?? '');
  const webhook = `https://${a.shop.slug}.${process.env.SHOP_ROOT_DOMAIN || 'sysrent.shop'}/api/line/webhook`;

  if (x.action === 'config') {
    const cfg = normalizeConfig(x.config);   // ค่าแปลก / เกินขนาด → ตัดทิ้ง ไม่เชื่อหน้าเว็บ
    const { error } = await d.from('shops').update({ line_bot: cfg }).eq('id', sid);
    if (missing(error)) return fail('ยังไม่ได้รัน 0030_line_bot_settings.sql ใน Supabase', 400);
    if (error) return fail('บันทึกไม่สำเร็จ', 500);
    forgetBotConfig(sid);
    return ok(cfg.enabled ? 'บันทึกแล้ว — บอทใช้ค่าใหม่ทันที' : 'บันทึกแล้ว — บอทปิดอยู่ (ไม่ตอบแชท)');
  }
  if (x.action === 'sell') {
    const { error } = await d.from('shops').update({ line_shop: x.on }).eq('id', sid);
    if (missing(error)) return fail('ยังไม่ได้รัน 0029_line_shop.sql ใน Supabase', 400);
    return error ? fail('บันทึกไม่สำเร็จ', 500) : ok(x.on ? 'เปิดขายสินค้าในแชทแล้ว' : 'ปิดขายสินค้าในแชทแล้ว (ต่อเมลยังทำงาน)');
  }
  if (x.action === 'line_save') {
    if (!encConfigured()) return fail('ระบบยังไม่ได้ตั้ง ENC_KEY — แจ้งผู้ดูแล SysRent', 500);
    const info = await lineBotInfo(x.token);
    if (!info) return fail('Channel access token ใช้ไม่ได้ — ตรวจว่าคัดลอกมาครบ และเป็นของช่อง Messaging API');
    const { error } = await saveShopLine(sid, x.secret.toLowerCase(), x.token, info);
    if (missing(error)) return fail('ยังไม่ได้รัน 0028_shop_renewals.sql ใน Supabase', 400);
    if (error) return fail('บันทึกไม่สำเร็จ', 500);
    // ตั้ง Webhook URL ให้เองในช่อง LINE ของร้าน
    const set = await lineSetWebhook(x.token, webhook);
    return ok(set
      ? `เชื่อม LINE "${info.botName}" (${info.basicId}) แล้ว และตั้ง Webhook ให้แล้ว — เปิด "Use webhook" ใน LINE Developers แล้วกดทดสอบ`
      : `เชื่อม LINE "${info.botName}" แล้ว แต่ตั้ง Webhook ให้ไม่ได้ — คัดลอกลิงก์ Webhook ไปวางใน LINE Developers เอง`);
  }
  if (x.action === 'line_test') {
    const line = await shopLine(sid);
    if (!line) return fail('ยังไม่ได้เชื่อม LINE OA');
    const wh = await lineWebhookInfo(line.token);
    if (!wh) return fail('ติดต่อ LINE ไม่ได้ — token อาจหมดอายุ ลองเชื่อมใหม่');
    if (wh.endpoint !== webhook) {
      if (!(await lineSetWebhook(line.token, webhook))) return fail(`Webhook URL ใน LINE ยังไม่ถูก ต้องเป็น ${webhook}`);
    }
    if (!wh.active) return fail('ยังไม่ได้เปิด "Use webhook" — LINE Developers → ช่องของร้าน → Messaging API → เปิด Use webhook');
    const t = await lineWebhookTest(line.token);
    if (!t?.success) return fail(t?.statusCode === 401 ? 'Channel secret ไม่ตรงกับช่องนี้ — ตรวจแล้วเชื่อมใหม่' : `LINE ส่งเข้าเว็บร้านไม่สำเร็จ (${t?.statusCode ?? '-'} ${t?.reason ?? ''})`);
    return ok('✅ เชื่อมต่อสมบูรณ์ — ลองทัก LINE ร้านแล้วพิมพ์ "เมนู" ได้เลย');
  }
  await deleteShopLine(sid);
  return ok('ยกเลิกการเชื่อม LINE แล้ว');
}
