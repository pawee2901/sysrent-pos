import { NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { getShop } from '@/lib/shop';
import { lineSignatureOk, shopLine } from '@/lib/line';
import { renewAllowed } from '@/lib/renewals';
import { lineShopAllowed } from '@/lib/line-shop';
import { handleShopLineEvents } from '@/lib/renewal-bot';

export const dynamic = 'force-dynamic';

/**
 * Webhook LINE OA ของร้าน: https://<slug>.sysrent.shop/api/line/webhook (ร้านตั้งใน LINE Developers)
 * ร้านจากโดเมน → ตรวจลายเซ็นด้วย Channel secret ของร้าน → ตอบ 200 ทันที แล้วทำงานต่อหลังตอบ (ตรวจสลิปอาจนาน)
 * ทำ 2 เรื่อง: ต่อเมล (lib/renewal-bot) + ขายสินค้า (lib/line-shop) ตามแพ็กเกจ / การตั้งค่าของร้าน
 */
export async function POST(req: Request) {
  const shop = await getShop();
  if (!shop) return NextResponse.json({ error: 'shop not found' }, { status: 404 });
  const line = await shopLine(shop.id);
  if (!line) return NextResponse.json({ error: 'line not connected' }, { status: 404 });
  const raw = await req.text();
  if (!lineSignatureOk(line.secret, raw, req.headers.get('x-line-signature'))) return NextResponse.json({ error: 'bad signature' }, { status: 401 });

  // ร้านเปิด "ขายใน LINE" ไหม (ยังไม่รัน 0029 = ยังขายไม่ได้)
  const { data: cfg, error } = await db().from('shops').select('line_shop').eq('id', shop.id).maybeSingle();
  const on = { renewals: renewAllowed(shop.plan), sell: !error && lineShopAllowed({ plan: shop.plan, line_shop: cfg?.line_shop }) };
  // แพ็กเกจไม่รองรับ / ร้านปิด → ตอบ 200 (ไม่ให้ LINE ส่งซ้ำ) แต่ไม่ทำอะไร
  if ((!on.renewals && !on.sell) || !shop.active) return NextResponse.json({ ok: true, skipped: true });
  let events: Parameters<typeof handleShopLineEvents>[2] = [];
  try { events = (JSON.parse(raw) as { events?: typeof events }).events ?? []; } catch { /* body เสีย */ }
  if (events.length) after(() => handleShopLineEvents(shop, line, events, on));
  return NextResponse.json({ ok: true });
}
