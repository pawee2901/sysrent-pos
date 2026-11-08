import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { adminKind, hashPassword } from '@/lib/auth';
import { canUseTheme, ownedThemes } from '@/lib/themes';
import { can, PLAN_LABEL, minPlan, type Feature } from '@/lib/plan';
import { HEX, isAccent } from '@/lib/colors';
import { DISCORD_URL, postDiscord } from '@/lib/notify';
import { sendMail, shopSmtp, verifyGmail } from '@/lib/mail';
import { encConfigured, encrypt } from '@/lib/secret';
import { fontOf, isEffect, isLoader } from '@/lib/appearance';
import { parseMusic } from '@/lib/music';

const https = (max: number) => z.string().trim().max(max).refine((u) => !u || /^https:\/\//.test(u), 'ลิงก์ต้องขึ้นต้นด้วย https://');
/** ลิงก์ในร้าน (/p/...) หรือ https:// */
const link = z.string().trim().max(300).refine((u) => !u || /^https:\/\//.test(u) || /^\/(?!\/)/.test(u), 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือ / (หน้าในร้าน)');
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('shop'),
    name: z.string().trim().min(1, 'ใส่ชื่อร้าน').max(40), tagline: z.string().trim().max(60), logo_url: https(500),
    accent: z.string().trim().toLowerCase().refine(isAccent, 'สีร้านไม่ถูกต้อง'), line_url: https(200), announcement: z.string().trim().max(120),
    promptpay_id: z.string().regex(/^(\d{10}|\d{13}|\d{15})?$/, 'พร้อมเพย์ต้องเป็นเบอร์ 10 หลัก, เลข 13 หลัก หรือ e-Wallet 15 หลัก'),
    receiver_name: z.string().trim().max(200),
  }),
  z.object({
    action: z.literal('look'),
    facebook_url: https(200), banner_url: https(500), banner_link: link,
    popup_text: z.string().trim().max(300), popup_image: https(500), popup_link: link,
    bg_style: z.enum(['default', 'plain', 'aurora', 'dots', 'image', 'color']), bg_image: https(500),
    bg_color: z.string().trim().toLowerCase().refine((c) => !c || HEX.test(c), 'สีพื้นหลังไม่ถูกต้อง'),
    card_style: z.enum(['white', 'tint', 'glass']),
  }),
  z.object({ action: z.literal('theme'), theme: z.string().max(20) }),
  // Discord: url ว่าง = ไม่เปลี่ยนลิงก์เดิม (หน้าเว็บไม่ได้รับลิงก์เต็มกลับไป) · clear = ล้างลิงก์
  z.object({
    action: z.literal('discord'), url: z.string().trim().max(300).refine((u) => !u || DISCORD_URL.test(u), 'ลิงก์ Webhook ต้องเป็น https://discord.com/api/webhooks/...'),
    clear: z.boolean().default(false), events: z.array(z.enum(['order', 'manual', 'topup', 'stock', 'signup', 'report'])).max(6),
  }),
  z.object({ action: z.literal('discord_test') }),
  // Gmail ของร้าน: ลองล็อกอินก่อนบันทึก · App Password ไม่ส่งกลับหน้าเว็บ
  z.object({ action: z.literal('mail'), email: z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง').max(120), app_password: z.string().max(40) }),
  z.object({ action: z.literal('mail_off') }),
  z.object({
    action: z.literal('appearance'), font: z.string().max(20).refine((k) => !k || !!fontOf(k), 'ไม่มีฟอนต์นี้'), effect: z.string().refine(isEffect, 'ไม่มีเอฟเฟกต์นี้'),
    loader: z.string().refine(isLoader, 'ไม่มีเอฟเฟกต์นี้'), music_url: z.string().trim().max(500).refine((u) => !u || !!parseMusic(u), 'ลิงก์เพลงไม่ถูกต้อง'),
  }),
  z.object({ action: z.literal('mail_test') }),
  z.object({ action: z.literal('admin'), username: z.string().trim().min(3, 'ชื่อผู้ดูแลอย่างน้อย 3 ตัว').max(40), password: z.string().min(8, 'รหัสผ่านอย่างน้อย 8 ตัว').max(72) }),
]);

export async function POST(req: Request) {
  const a = await requireAdmin('settings');
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  if (b.data.action === 'admin' && (await adminKind()) !== 'owner') return fail('เปลี่ยนบัญชีหลังบ้านได้เฉพาะเจ้าของร้าน', 403);
  const d = db();
  const need: Partial<Record<string, Feature>> = { appearance: 'appearance', mail: 'mail', mail_test: 'mail' };
  const f = need[b.data.action];
  if (f && !can(a.shop.plan, f)) return fail(`ฟังก์ชันนี้อยู่ในแพ็กเกจ ${PLAN_LABEL[minPlan(f)]} ขึ้นไป`, 403);
  if (b.data.action === 'mail') {
    const pass = b.data.app_password.replace(/\s+/g, ''); // Google แสดงเป็นกลุ่มละ 4 ตัวคั่นเว้นวรรค
    if (!/^[a-zA-Z]{16}$/.test(pass)) return fail('App Password ต้องเป็นตัวอักษร 16 ตัว');
    if (!encConfigured()) return fail('ระบบยังไม่พร้อมเก็บรหัส (ยังไม่ได้ตั้ง ENC_KEY)', 503);
    const bad = await verifyGmail({ user: b.data.email, pass });
    if (bad) return fail(bad);
    const { error } = await d.from('shops').update({ smtp_user: b.data.email, smtp_pass_enc: encrypt(pass) }).eq('id', a.shop.id);
    return error ? fail(/smtp_/.test(error.message) ? 'ยังไม่ได้รัน SQL 0021_shop_mail.sql' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (b.data.action === 'appearance') {
    const { action: _a, ...upd } = b.data;
    const { error } = await d.from('shops').update(upd).eq('id', a.shop.id);
    return error ? fail(/font|effect|loader|music/.test(error.message) ? 'ยังไม่ได้รัน SQL 0022_shop_appearance.sql' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (b.data.action === 'mail_off') {
    const { error } = await d.from('shops').update({ smtp_user: '', smtp_pass_enc: '' }).eq('id', a.shop.id);
    return error ? fail('บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (b.data.action === 'mail_test') {
    const smtp = await shopSmtp(a.shop.id);
    if (!smtp) return fail('ยังไม่ได้เชื่อม Gmail');
    // ส่งเข้า Gmail ของร้านเองเท่านั้น (กันถูกใช้ยิงอีเมลหาคนอื่น)
    const ok = await sendMail({ to: smtp.user, fromName: a.shop.name, smtp, subject: `${a.shop.name}: ทดสอบอีเมลแจ้งเตือน`, text: 'ระบบแจ้งลูกค้าทางอีเมลของร้านพร้อมใช้งานแล้ว', html: '<p>ระบบแจ้งลูกค้าทางอีเมลของร้านพร้อมใช้งานแล้ว</p>' });
    return ok ? NextResponse.json({ ok: true }) : fail('ส่งไม่สำเร็จ ตรวจ App Password อีกครั้ง', 502);
  }
  if (b.data.action === 'discord') {
    const upd: Record<string, unknown> = { discord_events: b.data.events };
    if (b.data.clear) upd.discord_webhook = '';
    else if (b.data.url) upd.discord_webhook = b.data.url;
    const { error } = await d.from('shops').update(upd).eq('id', a.shop.id);
    return error ? fail(error.message.includes('discord') ? 'ยังไม่ได้รัน SQL 0009_discord_notify.sql' : 'บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (b.data.action === 'discord_test') {
    const { data } = await d.from('shops').select('discord_webhook').eq('id', a.shop.id).maybeSingle();
    if (!data?.discord_webhook) return fail('ยังไม่ได้ใส่ลิงก์ Webhook');
    const r = await postDiscord(data.discord_webhook, a.shop.name, [{ title: '✅ ทดสอบการแจ้งเตือน', description: 'ร้านเชื่อมกับ Discord สำเร็จ ออเดอร์ใหม่จะเด้งเข้าห้องนี้', color: 0x22c55e }]);
    return r.ok ? NextResponse.json({ ok: true }) : fail(r.error ?? 'ส่งไม่สำเร็จ', 502);
  }
  if (b.data.action === 'theme') {
    if (!canUseTheme(b.data.theme, ownedThemes(a.shop.plan, a.shop.themes_owned))) return fail('ธีมนี้ต้องปลดล็อกที่ sysrent.shop ก่อน', 403);
    // เปลี่ยนธีม = พื้นหลังกลับเป็น "ตามธีม" (รูปพื้นหลังที่อัปไว้ยังเก็บอยู่ เลือกกลับได้)
    const { error } = await d.from('shops').update({ theme: b.data.theme, bg_style: 'default' }).eq('id', a.shop.id);
    return error ? fail('บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }
  if (b.data.action === 'shop' || b.data.action === 'look') {
    const { action: _a, ...upd } = b.data;
    const { error } = await d.from('shops').update(upd).eq('id', a.shop.id);
    if (error) return fail('บันทึกไม่สำเร็จ', 500);
    return NextResponse.json({ ok: true });
  }
  await d.from('shops').update({ admin_username: b.data.username, admin_pass_hash: await hashPassword(b.data.password) }).eq('id', a.shop.id);
  // เปลี่ยนรหัสหลังบ้าน = ทุกเครื่องที่ล็อกอินหลังบ้านอยู่ต้องเข้าใหม่ (ยกเว้นลูกค้า)
  await d.from('shop_sessions').delete().eq('shop_id', a.shop.id).is('customer_id', null);
  return NextResponse.json({ ok: true });
}
