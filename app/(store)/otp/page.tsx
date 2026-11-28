import { otpLink, otpPublic } from '@/lib/otp-link';
import { otpAppTiles } from '@/lib/otp-apps';
import { notFound, redirect } from 'next/navigation';
import { loginUrl, to } from '@/lib/routes';
import { getShop } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { can } from '@/lib/plan';
import { otpAccounts } from '@/lib/otp-access';
import { OtpBox } from './OtpBox';

export const dynamic = 'force-dynamic';

export default async function OtpPage() {
  const shop = await getShop();
  if (!shop || !can(shop.plan, 'otp')) notFound();
  // ร้านเลือกให้ค้นที่เว็บ OTP อื่น → ส่งไปลิงก์นั้นเลย
  const link = await otpLink(shop.id);
  if (link) redirect(link);
  const me = await getCustomer();
  // ยังไม่ล็อกอิน + ร้านเปิดหน้ารับ OTP → ไปเว็บรับ OTP (แยกจากหน้าร้าน)
  if (!me) redirect((await otpPublic(shop.id)) ? to('/otp-web') : loginUrl('/otp'));
  const [accounts, apps] = await Promise.all([otpAccounts(shop.id, me.id), otpAppTiles(shop.id)]);
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>
      <OtpBox accounts={accounts} apps={apps} />
    </div>
  );
}
