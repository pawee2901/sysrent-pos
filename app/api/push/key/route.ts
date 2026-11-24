import { NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { vapidKeys } from '@/lib/webpush';

/** กุญแจสาธารณะ VAPID (หน้าเว็บใช้ตอนเปิดรับแจ้งเตือน) */
export async function GET() {
  const k = await vapidKeys();
  return k ? NextResponse.json({ ok: true, key: k.publicKey }) : fail('ระบบแจ้งเตือนยังไม่พร้อม', 503);
}
