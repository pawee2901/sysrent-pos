'use client';
import { fromPublic, to } from '@/lib/routes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { api } from '@/components/Cart';
import { PLAN_LABEL, PLAN_PRICE, can, isPlan, type Feature } from '@/lib/plan';
import { PERMS } from '@/lib/perms';

const LOCKS: Record<string, Feature> = { '/accounting': 'accounting', '/agents': 'agents', '/reports': 'report' };
const PERM_OF: Record<string, string> = Object.fromEntries(PERMS.map((p) => [p.href, p.key]));

const MENU: { g: string; items: [string, string, string][] }[] = [
  { g: 'ร้านค้า', items: [['', 'ภาพรวม', 'home'], ['/orders', 'ออเดอร์', 'orders'], ['/reports', 'แจ้งปัญหา', 'alert'], ['/products', 'สินค้า', 'products'], ['/accounts', 'คลังบัญชี', 'accounts'], ['/coupons', 'คูปอง', 'coupons']] },
  { g: 'ลูกค้าและเงิน', items: [['/customers', 'ลูกค้า', 'customers'], ['/agents', 'ตัวแทน', 'agents'], ['/payments', 'การชำระเงิน', 'payments'], ['/accounting', 'บัญชี', 'chart']] },
  // ซ่อนไว้ก่อน (ยังไม่มีหน้า): Smart Stock (/smart-stock)
  { g: 'ร้านของฉัน', items: [['/settings', 'ตั้งค่าร้าน', 'settings']] },
];
const MOBILE: [string, string, string][] = [['', 'ภาพรวม', 'home'], ['/orders', 'ออเดอร์', 'orders'], ['/products', 'สินค้า', 'products'], ['/customers', 'ลูกค้า', 'customers'], ['/settings', 'ตั้งค่า', 'settings']];
const TITLE: Record<string, string> = Object.fromEntries(MENU.flatMap((m) => m.items.map(([h, l]) => [h, l])));
const ICON: Record<string, string> = Object.fromEntries(MENU.flatMap((m) => m.items.map(([h, , i]) => [h, i])));

/** โครงหลังบ้าน: แถบซ้าย + แถบบน + เมนูล่าง (มือถือ) */
export function AdminNav({ shop, counts, slip, plan, perms, staff = false, children }: {
  shop: { name: string; slug: string; logo: string }; counts: { orders: number; accounts: number };
  slip: { used: number; quota: number; overage: number }; plan: string; perms: string[]; staff?: boolean; children: React.ReactNode;
}) {
  const path = fromPublic(usePathname() ?? '/');
  // เมนูที่เข้าได้ (เจ้าของร้าน = ทุกเมนู · แอดมิน = ตามสิทธิ์) — key ของสิทธิ์ = path เมนู ('' = ภาพรวม)
  const allowed = ([h]: [string, string, string]) => perms.includes(PERM_OF[h] ?? '');
  const cur = path.replace(/^\/admin/, '').split('/').slice(0, 2).join('/');
  const badge = (h: string) => (h === '/orders' ? queue : h === '/accounts' ? counts.accounts : h === '/reports' ? reports : 0);
  // ตัวนับสลิป: layout ไม่โหลดใหม่ตอนเปลี่ยนเมนู → ดึงตัวเลขใหม่เองทุกครั้งที่เปลี่ยนหน้า
  const [used, setUsed] = useState(slip.used);
  const [reports, setReports] = useState(0);
  const [queue, setQueue] = useState(counts.orders);
  useEffect(() => { api<{ used: number; reports: number; queue: number }>('/api/admin/slip-usage', undefined, 'GET').then((r) => { if (r.ok) { setUsed(r.data.used); setReports(r.data.reports ?? 0); setQueue(r.data.queue ?? 0); } }); }, [path]);
  const pct = Math.min(100, Math.round((used / Math.max(1, slip.quota)) * 100));
  const link = ([h, l, i]: [string, string, string]) => (
    <Link key={h} href={to(`/admin${h}`)} className={cur === h ? 'on' : ''} aria-current={cur === h ? 'page' : undefined}>
      <Icon name={i} />{l}{LOCKS[h] && !can(plan, LOCKS[h]) && <span className="nav-lock" title="อัปเกรดแพ็กเกจเพื่อใช้งาน">🔒</span>}{badge(h) > 0 && <span className="count">{badge(h)}</span>}
    </Link>
  );
  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          {shop.logo ? <img src={shop.logo} alt="" className="mark" style={{ objectFit: 'cover' }} /> : <span className="mark">{shop.name.slice(0, 1).toUpperCase()}</span>}
          <div><b>{shop.name}</b><small>{shop.slug}.sysrent.shop</small></div>
        </div>
        {staff && <div className="staff-badge">🛡️ คุณเข้าในฐานะแอดมิน · เห็นเฉพาะเมนูที่เจ้าของร้านเปิดให้</div>}
        <nav className="nav">{MENU.map((m) => ({ ...m, items: m.items.filter(allowed) })).filter((m) => m.items.length).map((m) => <div key={m.g}><div className="nav-label">{m.g}</div>{m.items.map(link)}</div>)}</nav>
        <div className="side-foot">
          <div className="plan-row"><span className={`pill ${plan === 'pro' ? 'accent' : 'plain'}`}>แพ็กเกจ {PLAN_LABEL[isPlan(plan) ? plan : 'starter']}</span><span className="muted num">฿{PLAN_PRICE[isPlan(plan) ? plan : 'starter']}/เดือน</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>ตรวจสลิปเดือนนี้</b><span className="num">{used} / {slip.quota}</span></div>
          <div className={`meter${pct >= 80 ? ' warn' : ''}`}><i style={{ width: `${pct}%` }} /></div>
          <span className="muted" style={{ fontSize: 12 }}>เกินโควตา ฿{slip.overage.toFixed(2)}/สลิป ตัดจากกระเป๋า SysRent · ฟรี {slip.quota} ครั้ง/เดือน</span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <nav className="crumbs" aria-label="ตำแหน่ง">
            <span className="crumb-ic"><Icon name={ICON[cur] ?? 'home'} size={17} /></span>
            {cur && <><Link href={to('/admin')} className="crumb-root">หลังบ้าน</Link><svg className="crumb-sep" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg></>}
            <b>{TITLE[cur] ?? 'ภาพรวม'}</b>
          </nav>
          <div className="acts">
            <a href="/" className="btn sm" target="_blank" rel="noopener noreferrer">ดูหน้าร้าน ↗</a>
            <button type="button" className="btn ghost sm" onClick={async () => { await Promise.all([api('/api/admin/login', { logout: true }), api('/api/auth/logout')]); window.location.href = '/admin'; }}>ออกจากระบบ</button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
      <nav className="mnav" aria-label="เมนูหลังบ้าน">
        {MOBILE.filter(allowed).map(([h, l, i]) => (
          <Link key={h} href={to(`/admin${h}`)} className={cur === h ? 'on' : ''}><Icon name={i} size={22} />{l}{badge(h) > 0 && <span className="count">{badge(h)}</span>}</Link>
        ))}
      </nav>
    </div>
  );
}
