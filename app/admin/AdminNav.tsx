'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { api } from '@/components/Cart';

const MENU: { g: string; items: [string, string, string][] }[] = [
  { g: 'ร้านค้า', items: [['', 'ภาพรวม', 'home'], ['/orders', 'ออเดอร์', 'orders'], ['/products', 'สินค้า', 'products'], ['/accounts', 'คลังบัญชี', 'accounts']] },
  { g: 'ลูกค้าและเงิน', items: [['/customers', 'ลูกค้า', 'customers'], ['/payments', 'การชำระเงิน', 'payments']] },
  { g: 'ร้านของฉัน', items: [['/settings', 'ตั้งค่าร้าน', 'settings']] },
];
const MOBILE: [string, string, string][] = [['', 'ภาพรวม', 'home'], ['/orders', 'ออเดอร์', 'orders'], ['/products', 'สินค้า', 'products'], ['/accounts', 'คลังบัญชี', 'accounts'], ['/settings', 'ตั้งค่า', 'settings']];
const TITLE: Record<string, string> = Object.fromEntries(MENU.flatMap((m) => m.items.map(([h, l]) => [h, l])));

/** โครงหลังบ้าน: แถบซ้าย + แถบบน + เมนูล่าง (มือถือ) */
export function AdminNav({ shop, counts, slip, children }: {
  shop: { name: string; slug: string; logo: string }; counts: { orders: number; accounts: number };
  slip: { used: number; quota: number; overage: number }; children: React.ReactNode;
}) {
  const path = usePathname();
  const cur = path.replace(/^\/admin/, '').split('/').slice(0, 2).join('/');
  const badge = (h: string) => (h === '/orders' ? counts.orders : h === '/accounts' ? counts.accounts : 0);
  const pct = Math.min(100, Math.round((slip.used / Math.max(1, slip.quota)) * 100));
  const link = ([h, l, i]: [string, string, string]) => (
    <Link key={h} href={`/admin${h}`} className={cur === h ? 'on' : ''} aria-current={cur === h ? 'page' : undefined}>
      <Icon name={i} />{l}{badge(h) > 0 && <span className="count">{badge(h)}</span>}
    </Link>
  );
  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          {shop.logo ? <img src={shop.logo} alt="" className="mark" style={{ objectFit: 'cover' }} /> : <span className="mark">{shop.name.slice(0, 1).toUpperCase()}</span>}
          <div><b>{shop.name}</b><small>{shop.slug}.sysrent.shop</small></div>
        </div>
        <nav className="nav">{MENU.map((m) => <div key={m.g}><div className="nav-label">{m.g}</div>{m.items.map(link)}</div>)}</nav>
        <div className="side-foot">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>ตรวจสลิปเดือนนี้</b><span className="num">{slip.used} / {slip.quota}</span></div>
          <div className={`meter${pct >= 80 ? ' warn' : ''}`}><i style={{ width: `${pct}%` }} /></div>
          <span className="muted" style={{ fontSize: 12 }}>เกินโควตา ฿{slip.overage.toFixed(2)}/สลิป ตัดจากกระเป๋า SysRent</span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="crumbs">หลังบ้าน / <b>{TITLE[cur] ?? 'ภาพรวม'}</b></div>
          <div className="acts">
            <a href="/" className="btn sm" target="_blank" rel="noopener noreferrer">ดูหน้าร้าน ↗</a>
            <button type="button" className="btn ghost sm" onClick={async () => { await api('/api/admin/login', { logout: true }); window.location.href = '/admin'; }}>ออกจากระบบ</button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
      <nav className="mnav" aria-label="เมนูหลังบ้าน">
        {MOBILE.map(([h, l, i]) => (
          <Link key={h} href={`/admin${h}`} className={cur === h ? 'on' : ''}><Icon name={i} size={22} />{l}{badge(h) > 0 && <span className="count">{badge(h)}</span>}</Link>
        ))}
      </nav>
    </div>
  );
}
