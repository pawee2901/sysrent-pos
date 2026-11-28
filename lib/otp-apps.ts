import 'server-only';
import { db } from '@/lib/db';
import { TEMPLATES } from '@/lib/templates';

export type OtpAppTile = { id: string; name: string; image: string; template: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
/** ชื่อหนึ่งอยู่ในอีกชื่อ · สั้นกว่า 3 ตัวไม่นับ กันจับผิดแอป */
function sameApp(x: string, y: string) {
  const a = norm(x), b = norm(y);
  return a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));
}

/** แอป OTP ของร้าน + โลโก้ (แอปไม่มีรูปของตัวเอง → ใช้โลโก้สินค้าที่ชื่อตรงกัน · ไม่มีค่อยใช้แม่แบบ) */
export async function otpAppTiles(shopId: string): Promise<OtpAppTile[]> {
  const [{ data: apps }, { data: products }] = await Promise.all([
    db().from('shop_otp_apps').select('id, name').eq('shop_id', shopId).order('sort').order('created_at'),
    db().from('shop_products').select('name, image, template').eq('shop_id', shopId),
  ]);
  return ((apps ?? []) as { id: string; name: string }[]).map((a) => {
    const same = (products ?? []).filter((p) => sameApp(p.name as string, a.name));
    const p = same.find((x) => x.image) ?? same[0];
    return { ...a, image: (p?.image as string | undefined) ?? '', template: (p?.template as string | undefined) || TEMPLATES.find((t) => sameApp(t.name, a.name))?.key || '' };
  });
}
