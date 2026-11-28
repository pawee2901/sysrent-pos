import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getShop } from '@/lib/shop';
import { can } from '@/lib/plan';
import { otpAgent, otpLink, otpPublic } from '@/lib/otp-link';
import { otpAppTiles } from '@/lib/otp-apps';
import { activeTheme, ownedThemes } from '@/lib/themes';
import { shopContacts } from '@/lib/contacts-server';
import { ContactFab } from '@/components/ContactFab';
import { OtpBox } from '../../(store)/otp/OtpBox';
import css from './otpweb.module.css';
import '../../store.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'รับรหัส OTP' };

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
  const [agent, apps, contacts] = await Promise.all([otpAgent(shop.id), otpAppTiles(shop.id), shopContacts(shop)]);
  const theme = activeTheme(shop.theme ?? 'modern', ownedThemes(shop.plan, shop.themes_owned));
  return (
    <div className={`store ${css.page}`} data-style={theme} data-card={shop.card_style ?? 'white'}>
      <header className={css.head}>
        {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} className={css.logo} /> : <span className={css.mark}>{shop.name.slice(0, 1).toUpperCase()}</span>}
        <div><b>{shop.name}</b><small>ระบบรับรหัส OTP อัตโนมัติ</small></div>
      </header>
      <main className={css.main}>
        <div className={css.hero}>
          <span className={css.badge}>🔐 OTP</span>
          <h1>รับรหัส OTP</h1>
          <p>เลือกแอป กรอกอีเมลบัญชี{agent ? ' และรหัสที่ได้จากร้าน' : 'ที่ได้จากร้าน'} แล้วกดค้นหา · รหัสขึ้นเองภายในไม่กี่วินาที</p>
        </div>
        <OtpBox accounts={[]} apps={apps} open agent={agent} />
        <ol className={css.steps}>
          <li><b>1</b><span>เข้าแอปที่ต้องการ แล้วกด &quot;ส่งรหัสทางอีเมล&quot;</span></li>
          <li><b>2</b><span>กลับมาเลือกแอปนี้ กรอกอีเมล แล้วกดค้นหาภายใน 15 นาที</span></li>
          <li><b>3</b><span>คัดลอกรหัสไปกรอกในแอป ใช้งานได้ทันที</span></li>
        </ol>
      </main>
      <footer className={css.foot}>© {new Date().getFullYear()} {shop.name} · <a href="/">ไปหน้าร้าน</a></footer>
      <ContactFab links={contacts} />
    </div>
  );
}
