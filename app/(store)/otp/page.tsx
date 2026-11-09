import { notFound, redirect } from 'next/navigation';
import { loginUrl } from '@/lib/routes';
import { getShop } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { can } from '@/lib/plan';
import { db } from '@/lib/db';
import { otpAccounts } from '@/lib/otp-access';
import { TEMPLATES } from '@/lib/templates';
import { OtpBox } from './OtpBox';

export const dynamic = 'force-dynamic';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
/** ชื่อหนึ่งอยู่ในอีกชื่อ · สั้นกว่า 3 ตัวไม่นับ กันจับผิดแอป */
function sameApp(x: string, y: string) {
  const a = norm(x), b = norm(y);
  return a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));
}

export default async function OtpPage() {
  const shop = await getShop();
  if (!shop || !can(shop.plan, 'otp')) notFound();
  const me = await getCustomer();
  if (!me) redirect(loginUrl('/otp'));
  const [accounts, { data: apps }, { data: products }] = await Promise.all([
    otpAccounts(shop.id, me.id),
    db().from('shop_otp_apps').select('id, name').eq('shop_id', shop.id).order('sort').order('created_at'),
    db().from('shop_products').select('name, image, template').eq('shop_id', shop.id),
  ]);
  // แอป OTP ไม่มีรูปของตัวเอง → ใช้โลโก้สินค้าร้านที่ชื่อตรงกัน (เช่น ChatGPT ↔ ChatGPT Plus) · ไม่มีค่อยใช้แม่แบบ
  const withLogo = (apps ?? []).map((a) => {
    const same = (products ?? []).filter((p) => sameApp(p.name, a.name));
    const p = same.find((x) => x.image) ?? same[0];
    return { ...a, image: (p?.image as string | undefined) ?? '', template: (p?.template as string | undefined) || TEMPLATES.find((t) => sameApp(t.name, a.name))?.key || '' };
  });
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>
      <OtpBox accounts={accounts} apps={withLogo} />
    </div>
  );
}
