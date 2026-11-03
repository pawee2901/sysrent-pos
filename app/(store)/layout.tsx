import Link from 'next/link';
import { getShop, baht } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { CartProvider, CartCount } from '@/components/Cart';
import { Icon } from '@/components/Icon';
import { TabBar } from './TabBar';
import '../store.css';

/** โครงหน้าร้าน: หัวเว็บ · เนื้อหา · ท้ายเว็บ · ปุ่ม LINE · เมนูล่าง (มือถือ) */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const shop = (await getShop())!;
  const me = await getCustomer();
  return (
    <CartProvider shop={shop.slug}>
      {shop.announcement && <div className="announce">{shop.announcement}</div>}
      <header className="top">
        <div className="wrap top-row">
          <Link href="/" className="shop-brand">
            {shop.logo_url ? <img src={shop.logo_url} alt="" className="shop-mark" style={{ objectFit: 'cover' }} /> : <span className="shop-mark">{shop.name.slice(0, 1).toUpperCase()}</span>}
            {shop.name}
          </Link>
          <form className="search" action="/" role="search">
            <Icon name="search" size={18} />
            <input className="input" name="q" placeholder="ค้นหาแอป เช่น Netflix, YouTube" aria-label="ค้นหา" />
          </form>
          <div className="top-acts">
            {me && <Link href="/wallet" className="wallet-chip" title="เติมเงิน">💳 {baht(me.balance)}</Link>}
            <Link href="/cart" className="icon-btn" aria-label="ตะกร้า"><Icon name="bag" size={22} /><CartCount /></Link>
            {me
              ? <Link href="/my" className="icon-btn desk" aria-label="บัญชีของฉัน"><span className="avatar">{me.username.slice(0, 1).toUpperCase()}</span></Link>
              : <Link href="/login" className="btn primary sm">เข้าสู่ระบบ</Link>}
          </div>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer>
        <div className="wrap">
          <span>© {new Date().getFullYear()} {shop.name} · ร้านค้าบน <b>SysRent</b></span>
          <span><Link href="/">หน้าแรก</Link> · <Link href="/orders">ออเดอร์</Link> · <Link href="/terms">เงื่อนไขการใช้งาน</Link></span>
        </div>
      </footer>
      {shop.line_url && <a className="line-fab" href={shop.line_url} target="_blank" rel="noopener noreferrer" aria-label="ติดต่อร้านทาง LINE">LINE</a>}
      <TabBar loggedIn={!!me} />
    </CartProvider>
  );
}
