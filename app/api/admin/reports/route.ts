import { NextResponse, after } from 'next/server';
import { lineReportNotice } from '@/lib/line-shop';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireAdmin } from '@/lib/api';
import { encConfigured, encrypt } from '@/lib/secret';

const schema = z.discriminatedUnion('action', [
  // ตอบกลับ / ปิดเรื่อง (ลูกค้าเห็นคำตอบในหน้าประวัติ)
  z.object({ action: z.literal('reply'), id: z.string().uuid(), reply: z.string().trim().max(1000).default(''), resolve: z.boolean().default(false) }),
  // แก้ไอดีที่ส่งให้ลูกค้าแล้ว (เปลี่ยนรหัส / เมลใหม่) — ลูกค้าเห็นของใหม่ทันทีในหน้าประวัติ
  z.object({ action: z.literal('edit_item'), itemId: z.string().uuid(), delivered: z.string().trim().min(1, 'ไอดีว่างไม่ได้').max(4000) }),
  // แบบแบ่งจอ: แก้บัญชีหลัก + จอที่ลูกค้าเช่าอยู่ · password ว่าง = ไม่เปลี่ยนรหัส
  z.object({ action: z.literal('edit_slot'), itemId: z.string().uuid(), slotId: z.string().uuid(), login: z.string().trim().min(3, 'ใส่อีเมลบัญชี').max(120), password: z.string().max(200), label: z.string().trim().min(1, 'ใส่ชื่อโปรไฟล์').max(40), pin: z.string().trim().max(12) }),
]);

export async function POST(req: Request) {
  const a = await requireAdmin('reports');
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db(), x = b.data;

  if (x.action === 'edit_slot') {
    const { data: slot } = await d.from('shop_slots').select('id, account_id, shop_accounts!inner(shop_id)').eq('id', x.slotId).eq('shop_accounts.shop_id', a.shop.id).maybeSingle();
    if (!slot) return fail('ไม่พบจอ', 404);
    // ต้องเป็นการเช่าที่ยังใช้อยู่ของรายการนี้ — จอที่หมดอายุแล้วอาจเป็นของลูกค้าคนใหม่
    const { data: sub } = await d.from('shop_subscriptions').select('id').eq('order_item_id', x.itemId).eq('slot_id', x.slotId).eq('status', 'active').gt('ends_at', new Date().toISOString()).maybeSingle();
    if (!sub) return fail('การเช่านี้หมดอายุแล้ว แก้บัญชีที่เมนู "คลังบัญชี"', 409);
    if (x.password && !encConfigured()) return fail('ระบบยังไม่ได้ตั้งกุญแจเข้ารหัส กรุณาติดต่อ SysRent', 503);
    const acc: Record<string, unknown> = { login: x.login };
    if (x.password) acc.secret_enc = encrypt(x.password);
    const { error: accErr } = await d.from('shop_accounts').update(acc).eq('id', slot.account_id);
    if (accErr) return fail('บันทึกไม่สำเร็จ', 500);
    const { error: slotErr } = await d.from('shop_slots').update({ label: x.label, pin: x.pin }).eq('id', x.slotId);
    return slotErr ? fail('บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }

  if (x.action === 'edit_item') {
    // รายการต้องเป็นของร้านนี้ และส่งของไปแล้ว (แบบแบ่งจอใช้ edit_slot เพราะข้อมูลอยู่ที่บัญชีหลัก ไม่ใช่ในรายการ)
    const { data: it } = await d.from('shop_order_items').select('id, status, fulfillment, shop_orders!inner(shop_id)').eq('id', x.itemId).eq('shop_orders.shop_id', a.shop.id).maybeSingle();
    if (!it) return fail('ไม่พบรายการ', 404);
    if (it.fulfillment === 'slot') return fail('สินค้าแบบแบ่งจอ แก้รหัสที่เมนู "คลังบัญชี"', 400);
    if (it.status !== 'delivered') return fail('รายการนี้ยังไม่ได้ส่งของ — ส่งของที่หน้าออเดอร์', 400);
    const { error } = await d.from('shop_order_items').update({ delivered: x.delivered }).eq('id', x.itemId); // ไม่แตะ updated_at: สินค้าสั่งทำนับประกันจากเวลาส่งของ
    return error ? fail('บันทึกไม่สำเร็จ', 500) : NextResponse.json({ ok: true });
  }

  const upd: Record<string, unknown> = { reply: x.reply };
  if (x.resolve) { upd.status = 'resolved'; upd.resolved_at = new Date().toISOString(); }
  const { data, error } = await d.from('shop_reports').update(upd).eq('id', x.id).eq('shop_id', a.shop.id).select('id');
  if (error) return fail('บันทึกไม่สำเร็จ', 500);
  if (!data?.length) return fail('ไม่พบเรื่องนี้', 404);
  // ลูกค้ามาจาก LINE ร้าน + ร้านเปิด "ร้านตอบเรื่องที่ลูกค้าแจ้งปัญหา" (หลังบ้าน → บอท LINE) → แจ้งในแชท
  if (x.reply) after(() => lineReportNotice(a.shop, x.id).catch((e) => console.error('[line] report notice', e)));
  return NextResponse.json({ ok: true });
}
