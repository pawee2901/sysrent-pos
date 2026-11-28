import type { Metadata } from 'next';
import { otpSiteBrand } from '@/lib/otp-link';
import { notFound, redirect } from 'next/navigation';
import { getShop } from '@/lib/shop';
import { can } from '@/lib/plan';
import { otpAgent, otpLink, otpPublic } from '@/lib/otp-link';
import { otpAppTiles } from '@/lib/otp-apps';
import { activeTheme, ownedThemes } from '@/lib/themes';
import { shopContacts } from '@/lib/contacts-server';
import { ContactFab } from '@/components/ContactFab';
import { OtpWebClient } from './OtpWebClient';
import { db } from '@/lib/db';
import css from './otpweb.module.css';
import '../../store.css';

export const dynamic = 'force-dynamic';
/** ชื่อแท็บ / ไอคอน / รูปตอนแชร์ลิงก์ = ของเว็บรับ OTP (ไม่ตั้ง = ของร้าน) */
export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop();
  if (!shop) return { title: 'รับรหัส OTP' };
  const b = await otpSiteBrand(shop.id);
  const name = b.name || shop.name, logo = b.logo || shop.logo_url;
  return { title: { absolute: `${name} — รับรหัส OTP` }, description: 'เลือกแอป กรอกอีเมล รับรหัส OTP อัตโนมัติ',
    ...(logo ? { icons: { icon: logo, apple: logo } } : {}), openGraph: { title: `${name} — รับรหัส OTP`, siteName: name, ...(logo ? { images: [logo] } : {}) } };
}

/**
 * เว็บรับ OTP (แยกจากหน้าร้าน): ลิงก์เดียวให้ลูกค้าทุกคน ไม่ต้องล็อกอิน
 * ไม่มีเมนูร้าน / ตะกร้า / กระเป๋าเงิน — มีแค่โลโก้ร้าน + เลือกแอป + กรอกอีเมล (+ รหัสตัวแทน) → รหัสขึ้นเอง
 * ร้านต้องเลือก "💬 หน้ารับ OTP" ในหลังบ้าน (ไม่งั้น = ไม่พบหน้า)
 */
export default async function OtpWeb() {
  const shop = await getShop();
  if (!shop || !can(shop.plan, 'otp')) notFound();
  const link = await otpLink(shop.id);
  if (link) redirect(link);
  if (!(await otpPublic(shop.id))) notFound();
  const [agent, apps, contacts, brand] = await Promise.all([otpAgent(shop.id), otpAppTiles(shop.id), shopContacts(shop), otpSiteBrand(shop.id)]);
  const name = brand.name || shop.name, logo = brand.logo || shop.logo_url;
  // ระบบตัวแทนใช้รหัส 4 หลักทุกอีเมล → ช่องรหัส 4 ช่อง (มีชื่อยูส / อีเมลตัวแทน = ช่องเดียว)
  const { data: kinds } = agent ? await db().from('shop_otp_access').select('kind').eq('shop_id', shop.id).neq('kind', 'pin').limit(1) : { data: [] };
  const pinOnly = agent && !(kinds ?? []).length;
  const theme = activeTheme(shop.theme ?? 'modern', ownedThemes(shop.plan, shop.themes_owned));
  return (
    <div className={`store ${css.page}`} data-style={theme} data-card={shop.card_style ?? 'white'}>
      <main className={css.main}>
        <OtpWebClient name={name} logo={logo} apps={apps} agent={agent} pinOnly={pinOnly} />
      </main>
      <footer className={css.foot}>© {new Date().getFullYear()} {name} · <a href="/">ไปหน้าร้าน {shop.name}</a></footer>
      <ContactFab links={contacts} />
    </div>
  );
}
