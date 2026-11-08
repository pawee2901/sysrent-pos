import { NextResponse } from 'next/server';
import { z } from 'zod';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { fail, requireCustomer } from '@/lib/api';
import { REPORT_TOPICS, canReport } from '@/lib/reports';
import { notifyReport } from '@/lib/notify';

const schema = z.object({
  code: z.string().regex(/^[A-F0-9]{8}$/, 'เลขออเดอร์ไม่ถูกต้อง'),
  topic: z.enum(REPORT_TOPICS, { error: 'กรุณาเลือกเรื่องที่พบ' }),
  message: z.string().trim().max(1000, 'รายละเอียดยาวเกิน 1,000 ตัวอักษร').default(''),
});

/** รูปที่แนบ → ย่อ / แปลงเป็น jpg ใหม่ (ตัดข้อมูลแฝงในไฟล์ · รูปเสียหรือไม่ใช่รูป = ไม่รับ) → bucket shop-media/<ร้าน>/reports/ */
async function saveImage(shopId: string, file: Blob): Promise<string | { error: string }> {
  if (file.size > 8 * 1024 * 1024) return { error: 'รูปใหญ่เกิน 8MB' };
  let out: Buffer;
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  } catch { return { error: 'ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ' }; }
  const path = `${shopId}/reports/${crypto.randomUUID()}.jpg`;
  const st = db().storage.from('shop-media');
  const { error } = await st.upload(path, out, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) { console.error('[report upload]', error.message); return { error: 'อัปโหลดรูปไม่สำเร็จ' }; }
  return st.getPublicUrl(path).data.publicUrl;
}

/** ลูกค้าแจ้งปัญหาออเดอร์ (แพ็กเกจ Pro) — เรื่อง + รายละเอียด + รูป (ไม่บังคับ) → ร้านเห็นในหลังบ้าน + แจ้ง Discord */
export async function POST(req: Request) {
  const a = await requireCustomer();
  if ('res' in a) return a.res;
  if (!canReport(a.shop.plan)) return fail('ร้านนี้ยังไม่เปิดระบบแจ้งปัญหา กรุณาติดต่อร้านทาง LINE', 403);
  const form = await req.formData().catch(() => null);
  if (!form) return fail('ข้อมูลไม่ถูกต้อง');
  const p = schema.safeParse({ code: form.get('code'), topic: form.get('topic'), message: form.get('message') ?? '' });
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
  const { code, topic } = p.data;
  const message = p.data.message ?? '';
  const d = db();

  const { data: o } = await d.from('shop_orders').select('id, code, status').eq('shop_id', a.shop.id).eq('customer_id', a.me.id).eq('code', code).maybeSingle();
  if (!o) return fail('ไม่พบออเดอร์', 404);
  if (o.status === 'pending' || o.status === 'cancelled') return fail('ออเดอร์นี้ยังไม่ได้ชำระเงิน');
  const { data: open, error: e1 } = await d.from('shop_reports').select('id').eq('order_id', o.id).eq('status', 'open').limit(1);
  if (e1) return fail('ร้านยังไม่เปิดระบบแจ้งปัญหา (ยังไม่ได้รัน SQL 0013)', 503);
  if (open?.length) return fail('แจ้งเรื่องนี้ไว้แล้ว รอร้านตอบกลับ', 409);
  const { count } = await d.from('shop_reports').select('id', { count: 'exact', head: true }).eq('customer_id', a.me.id).gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= 5) return fail('แจ้งปัญหาได้ไม่เกิน 5 ครั้งต่อวัน กรุณาติดต่อร้านทาง LINE', 429);

  // รูปแนบ (ตรวจสิทธิ์ทั้งหมดผ่านแล้วถึงจะอัป)
  let image = '';
  const file = form.get('image');
  if (file instanceof Blob && file.size) {
    const r = await saveImage(a.shop.id, file);
    if (typeof r !== 'string') return fail(r.error);
    image = r;
  }

  const row = { shop_id: a.shop.id, customer_id: a.me.id, order_id: o.id, topic, message, ...(image ? { image } : {}) };
  const { error } = await d.from('shop_reports').insert(row);
  if (error) return fail(error.message.includes('image') ? 'ร้านยังไม่เปิดการแนบรูป (ยังไม่ได้รัน SQL 0015)' : 'ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่', 500);
  notifyReport(a.shop, a.me.username, o.code, topic, message, image);
  return NextResponse.json({ ok: true });
}
