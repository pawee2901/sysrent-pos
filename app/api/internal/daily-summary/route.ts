import { after, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail } from '@/lib/api';
import { authorized } from '@/lib/internal';
import { sendDailySummary } from '@/lib/daily-summary';

/** ส่งสรุปยอดรายวันให้ทุกร้านที่เปิดไว้ · เรียกวันละครั้งจาก deploy/shop-hosts-sync.sh */
export async function POST(req: Request) {
  if (!authorized(req)) return fail('forbidden', 403);
  const { data, error } = await db().from('shops').select('id, name, slug, discord_webhook')
    .eq('active', true).gt('expires_at', new Date().toISOString()).neq('discord_webhook', '').contains('discord_events', ['daily']).limit(10000);
  if (error) return fail('db', 500);
  // ตอบก่อนแล้วค่อยส่ง: cron จดว่าวันนี้ส่งแล้วทันที ไม่เรียกซ้ำระหว่างที่ยังส่งไม่ครบทุกร้าน
  after(async () => {
    for (const shop of data ?? []) {
      try { await sendDailySummary(shop); } catch (e) { console.error('[daily-summary]', shop.id, e); }
    }
  });
  return NextResponse.json({ ok: true, shops: data?.length ?? 0 });
}
