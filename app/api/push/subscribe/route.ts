import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { body, fail, requireCustomer } from '@/lib/api';
import { pushCustomer, pushEndpointOk } from '@/lib/push';

const b64u = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(200);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('on'), endpoint: z.string().url().max(800).refine(pushEndpointOk, 'เบราว์เซอร์นี้ยังไม่รองรับ'), keys: z.object({ p256dh: b64u, auth: b64u }) }),
  z.object({ action: z.literal('off'), endpoint: z.string().max(800) }),
  z.object({ action: z.literal('test') }),
]);

/** ลูกค้าเปิด / ปิดรับแจ้งเตือนในเครื่องนี้ · test = ส่งข้อความทดสอบ */
export async function POST(req: Request) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  const b = await body(req, schema);
  if ('res' in b) return b.res;
  const d = db();
  if (b.data.action === 'off') {
    await d.from('shop_push_subs').delete().eq('endpoint', b.data.endpoint).eq('customer_id', a.me.id);
    return NextResponse.json({ ok: true });
  }
  if (b.data.action === 'test') {
    const n = await pushCustomer(a.shop.id, a.me.id, { title: `🔔 ${a.shop.name}`, body: 'เปิดรับแจ้งเตือนเรียบร้อย ร้านจะแจ้งเมื่อได้ของ / มีโปรใหม่', url: '/' });
    return n ? NextResponse.json({ ok: true }) : fail('ส่งไม่สำเร็จ ลองปิดแล้วเปิดรับแจ้งเตือนใหม่', 502);
  }
  // เครื่องเดิมเปลี่ยนบัญชี = ย้ายไปเป็นของบัญชีที่ล็อกอินอยู่
  const { error } = await d.from('shop_push_subs').upsert({ shop_id: a.shop.id, customer_id: a.me.id, endpoint: b.data.endpoint, p256dh: b.data.keys.p256dh, auth: b.data.keys.auth }, { onConflict: 'endpoint' });
  if (error) return fail(/shop_push_subs/.test(error.message) ? 'ร้านยังไม่ได้เปิดระบบแจ้งเตือน' : 'บันทึกไม่สำเร็จ', 500);
  return NextResponse.json({ ok: true });
}
