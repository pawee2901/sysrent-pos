import { notFound, redirect } from 'next/navigation';
import { loginUrl } from '@/lib/routes';
import { getShop } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { can } from '@/lib/plan';
import { db } from '@/lib/db';
import { otpAccounts } from '@/lib/otp-access';
import { OtpBox } from './OtpBox';

export const dynamic = 'force-dynamic';

export default async function OtpPage() {
  const shop = await getShop();
  if (!shop || !can(shop.plan, 'otp')) notFound();
  const me = await getCustomer();
  if (!me) redirect(loginUrl('/otp'));
  const [accounts, { data: apps }] = await Promise.all([
    otpAccounts(shop.id, me.id),
    db().from('shop_otp_apps').select('id, name').eq('shop_id', shop.id).order('sort').order('created_at'),
  ]);
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>
      <div><h1 style={{ fontSize: 24 }}>ค้นหา OTP</h1><p className="muted" style={{ margin: '4px 0 0' }}>ขอรหัสจากแอปก่อน แล้วกดค้นหาภายใน 15 นาที</p></div>
      <OtpBox accounts={accounts} apps={apps ?? []} />
    </div>
  );
}
