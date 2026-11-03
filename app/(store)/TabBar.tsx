'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CartCount } from '@/components/Cart';
import { Icon } from '@/components/Icon';

const TABS = [
  ['/', 'หน้าแรก', 'home'], ['/cart', 'ตะกร้า', 'bag'], ['/my', 'บัญชีของฉัน', 'key'], ['/orders', 'ออเดอร์', 'receipt'], ['/wallet', 'กระเป๋าเงิน', 'wallet'],
] as const;

/** เมนูล่างบนมือถือ */
export function TabBar({ loggedIn }: { loggedIn: boolean }) {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="เมนูหลัก">
      {TABS.map(([href, label, icon]) => {
        const on = href === '/' ? path === '/' || path.startsWith('/p/') : path.startsWith(href);
        const to = !loggedIn && href !== '/' && href !== '/cart' ? `/login?next=${href}` : href;
        return (
          <Link key={href} href={to} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
            <Icon name={icon} size={22} />{label}{href === '/cart' && <CartCount />}
          </Link>
        );
      })}
    </nav>
  );
}
