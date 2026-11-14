import { db } from '@/lib/db';
import { adminShop } from '@/lib/admin-page';
import { PlanLock } from '@/components/PlanLock';
import { can } from '@/lib/plan';
import { accentHex } from '@/lib/colors';
import { loadProducts } from '@/lib/catalog';
import { normalizeConfig } from '@/lib/line-bot-config';
import { LineBotClient } from './LineBotClient';

export const dynamic = 'force-dynamic';

/** บอท LINE: เชื่อม LINE OA ของร้าน + ตั้งค่าหน้าตา / ข้อความ / เมนู / การ์ดสินค้า / ข้อความที่เสียโควตา (กดตั้งเองได้ทั้งหมด) */
export default async function AdminLineBot() {
  const shop = await adminShop('linebot');
  if (!shop) return null;
  if (!can(shop.plan, 'line_shop')) return <PlanLock feature="line_shop" />;
  const d = db();
  const webhook = `https://${shop.slug}.${process.env.SHOP_ROOT_DOMAIN || 'sysrent.shop'}/api/line/webhook`;
  const [{ data: line, error: lineErr }, { data: cfgRow, error: cfgErr }, products] = await Promise.all([
    d.from('shop_line').select('bot_name, basic_id').eq('shop_id', shop.id).maybeSingle(),
    d.from('shops').select('line_bot, line_shop').eq('id', shop.id).maybeSingle(),
    loadProducts(shop.id).catch(() => []),
  ]);
  if ((lineErr && ['42P01', 'PGRST205'].includes(lineErr.code ?? '')) || (cfgErr && ['42703', 'PGRST204'].includes(cfgErr.code ?? ''))) {
    return <div className="card card-pad"><h2 style={{ marginTop: 0 }}>บอท LINE</h2><p className="muted">ยังไม่ได้รัน migration ใน Supabase — รัน <code>0028</code> · <code>0029</code> · <code>0030</code> ตามลำดับ แล้วรีเฟรชหน้านี้</p></div>;
  }
  // สินค้าตัวอย่างในพรีวิว: ขายดีสุดที่มีรูป
  const sample = [...products].filter((p) => p.options.some((o) => o.active)).sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)) || b.sold - a.sold)[0];
  return (
    <LineBotClient
      config={normalizeConfig(cfgRow?.line_bot)} sell={cfgRow?.line_shop !== false}
      line={line ? { botName: line.bot_name, basicId: line.basic_id } : null} webhook={webhook}
      shop={{ name: shop.name, logo: shop.logo_url, accent: accentHex(shop.accent), otp: can(shop.plan, 'otp'), renew: can(shop.plan, 'renewals') }}
      sample={sample ? { name: sample.name, price: sample.from ?? 0, sold: sample.sold, left: sample.left, image: sample.image } : null}
    />
  );
}
