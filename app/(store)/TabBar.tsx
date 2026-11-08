'use client';
import { fromPublic, loginUrl, to } from '@/lib/routes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CartCount } from '@/components/Cart';
import { Icon } from '@/components/Icon';

const TABS = [
  ['/', 'หน้าแรก', 'home'], ['/cart', 'ตะกร้า', 'bag'], ['/orders', 'ประวัติ', 'receipt'], ['/wallet', 'กระเป๋าเงิน', 'wallet'],
] as const;

const OTP_TAB = ['/otp', 'OTP', 'lock'] as const;

/** เมนูล่างบนมือถือ */
export function TabBar({ loggedIn, otp = false }: { loggedIn: boolean; otp?: boolean }) {
  const path = fromPublic(usePathname() ?? '/');
  return (
    <nav className="tabbar" aria-label="เมนูหลัก">
      {(otp ? [...TABS.slice(0, 3), OTP_TAB, ...TABS.slice(3)] : TABS).map(([href, label, icon]) => {
        const on = href === '/' ? path === '/' || path.startsWith('/p/') : path.startsWith(href);
        const dest = !loggedIn && href !== '/' && href !== '/cart' ? loginUrl(href) : to(href);
        return (
          <Link key={href} href={dest} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
            <Icon name={icon} size={22} />{label}{href === '/cart' && <CartCount />}
          </Link>
        );
      })}
    </nav>
  );
}
