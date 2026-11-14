import { db } from '@/lib/db';
import { getShop } from '@/lib/shop';
import { signLinkOk } from '@/lib/line';
import { promptPayQrPng } from '@/lib/promptpay';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** รูป QR พร้อมเพย์ของร้าน (PNG) ให้ LINE ดึงไปแสดงในแชท — ต้องมีลายเซ็น · เฉพาะรายการที่ยังรอจ่าย */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const shop = await getShop();
  if (!shop || !/^[0-9a-f-]{36}$/i.test(id) || !signLinkOk(id, new URL(req.url).searchParams.get('t'))) return new Response('not found', { status: 404 });
  const { data: p } = await db().from('shop_renewal_pays').select('amount, status, expires_at').eq('id', id).eq('shop_id', shop.id).maybeSingle();
  if (!p || p.status !== 'pending' || new Date(p.expires_at).getTime() + 20 * 60_000 < Date.now() || !shop.promptpay_id) return new Response('expired', { status: 410 });
  const png = await promptPayQrPng(shop.promptpay_id, Number(p.amount));
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=1200' } });
}
