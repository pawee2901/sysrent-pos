import { to } from '@/lib/routes';
import Link from 'next/link';
import { getShop, baht } from '@/lib/shop';
import { customerEmail, getCustomer, isShopAdmin } from '@/lib/auth';
import { ContactFab } from '@/components/ContactFab';
import { FloatingFx } from '@/components/FloatingFx';
import { PageLoader } from '@/components/PageLoader';
import { MusicPlayer } from '@/components/MusicPlayer';
import { fontHref, fontOf, fontStack } from '@/lib/appearance';
import { db } from '@/lib/db';
import { UserMenu } from '@/components/UserMenu';
import { getAgent } from '@/lib/agents';
import { CartProvider, CartCount } from '@/components/Cart';
import { Icon } from '@/components/Icon';
import { Popup } from '@/components/Popup';
import { activeTheme, ownedThemes } from '@/lib/themes';
import { can } from '@/lib/plan';
import { TabBar } from './TabBar';
import '../store.css';

/** โครงหน้าร้าน: หัวเว็บ · เนื้อหา · ท้ายเว็บ · ปุ่ม LINE · เมนูล่าง (มือถือ) */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const shop = (await getShop())!;
  // ฟอนต์ / เพลง / เอฟเฟกต์ (แยก query: ยังไม่รัน 0022 = ไม่มี แต่หน้าร้านใช้งานได้)
  const [me, { data: ap, error: apErr }] = await Promise.all([
    getCustomer(),
    db().from('shops').select('font, effect, loader, music_url').eq('id', shop.id).maybeSingle(),
  ]);
  const [isAdmin, agent, email] = me ? await Promise.all([isShopAdmin(), getAgent(shop, me.id), customerEmail(me.id)]) : [false, null, ''];
  const look = apErr || !can(shop.plan, 'appearance') ? null : ap;
  const font = fontOf(look?.font ?? '');
  const theme = activeTheme(shop.theme ?? 'modern', ownedThemes(shop.plan, shop.themes_owned));
  // พื้นหลัง: ธีมโมเดิร์น + แบบมาตรฐาน = ใช้แสงสีของ body · ที่เหลือวาดชั้นพื้นหลังตามธีม / แบบที่ร้านเลือก
  const bg = (shop.bg_style === 'image' && !shop.bg_image) || (shop.bg_style === 'color' && !shop.bg_color) ? 'default' : shop.bg_style;
  return (
    <CartProvider shop={shop.slug}>
    <div className="store" data-style={theme} data-card={shop.card_style ?? 'white'} style={{ ...(bg === 'color' ? { ['--tint' as string]: shop.bg_color } : {}), ...(font ? { ['--font' as string]: fontStack(font.family), ['--font-head' as string]: fontStack(font.family) } : {}) }}>
      {font && <link rel="stylesheet" href={fontHref(font.key)} precedence="default" />}
      <PageLoader kind={look?.loader ?? 'none'} logo={shop.logo_url} />
      <FloatingFx effect={look?.effect ?? 'none'} />
      {look?.music_url && <MusicPlayer url={look.music_url} />}
      {(theme !== 'modern' || bg !== 'default') && (
        <div className="shop-bg" data-bg={bg} style={bg === 'image' ? { ['--bg-image' as string]: `url("${shop.bg_image}")` } : bg === 'color' ? { ['--bg-color' as string]: shop.bg_color } : undefined} aria-hidden="true" />
      )}
      {shop.announcement && <div className="announce">{shop.announcement}</div>}
      <header className="top">
        <div className="wrap top-row">
          {/* มีโลโก้ = แสดงโลโก้อย่างเดียว (รูปยาว/สี่เหลี่ยมได้) · ไม่มี = ตัวอักษรแรก + ชื่อร้าน */}
          <Link href="/" className="shop-brand" aria-label={shop.name}>
            {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} className="shop-logo" />
              : <><span className="shop-mark">{shop.name.slice(0, 1).toUpperCase()}</span>{shop.name}</>}
          </Link>
          <form className="search" action="/" role="search">
            <Icon name="search" size={18} />
            <input className="input" name="q" placeholder="ค้นหาแอป เช่น Netflix, YouTube" aria-label="ค้นหา" />
          </form>
          <div className="top-acts">
            {me && <Link href={to('/wallet')} className="wallet-chip" title="เติมเงิน"><Icon name="wallet" size={18} />{baht(me.balance)}</Link>}
            <Link href={to('/cart')} className="icon-btn" aria-label="ตะกร้า"><Icon name="bag" size={22} /><CartCount /></Link>
            {me
              ? <UserMenu username={me.username} contact={me.contact} balance={baht(me.balance)} isAdmin={isAdmin} isAgent={!!agent} email={email} mailOn={can(shop.plan, 'mail')} otpOn={can(shop.plan, 'otp')} />
              : <Link href={to('/login')} className="btn primary sm">เข้าสู่ระบบ</Link>}
          </div>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer>
        <div className="wrap">
          <span>© {new Date().getFullYear()} {shop.name} · ร้านค้าบน <b>SysRent</b></span>
          <span><Link href="/">หน้าแรก</Link> · <Link href={to('/orders')}>ออเดอร์</Link> · <Link href={to('/terms')}>เงื่อนไขการใช้งาน</Link>
            {shop.facebook_url && <> · <a href={shop.facebook_url} target="_blank" rel="noopener noreferrer">Facebook</a></>}{shop.line_url && <> · <a href={shop.line_url} target="_blank" rel="noopener noreferrer">LINE</a></>}</span>
        </div>
      </footer>
      <ContactFab line={shop.line_url} facebook={shop.facebook_url} />
      {(shop.popup_text || shop.popup_image) && <Popup shop={shop.slug} text={shop.popup_text} image={shop.popup_image} link={shop.popup_link} />}
      <TabBar loggedIn={!!me} otp={can(shop.plan, 'otp')} />
    </div>
    </CartProvider>
  );
}
