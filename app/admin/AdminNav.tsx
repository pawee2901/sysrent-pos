'use client';
import { fromPublic, to } from '@/lib/routes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { api } from '@/components/Cart';
import { PLAN_LABEL, can, isPlan, type Feature } from '@/lib/plan';
import { PERMS } from '@/lib/perms';
import { TutorialButton } from './TutorialButton';
import { NavSearch } from './NavSearch';
import css from './nav.module.css';

const LOCKS: Record<string, Feature> = { '/otp': 'otp', '/accounting': 'accounting', '/agents': 'agents', '/reports': 'report', '/renewals': 'renewals', '/line-bot': 'line_shop' };
const PERM_OF: Record<string, string> = Object.fromEntries(PERMS.map((p) => [p.href, p.key]));

/** เมนูหลัก 6 หมวด · แต่ละหมวดมีแท็บย่อย (path, ชื่อ) — หน้าแรกของหมวด = แท็บแรกที่เข้าได้ */
type Group = { k: string; l: string; i: string; items: [string, string][] };
const GROUPS: Group[] = [
  { k: 'home', l: 'ภาพรวม', i: 'home', items: [['', 'ภาพรวม']] },
  { k: 'products', l: 'สินค้า', i: 'products', items: [['/products', 'สินค้าทั้งหมด'], ['/coupons', 'คูปอง'], ['/reviews', 'รีวิว']] },
  { k: 'orders', l: 'ออเดอร์', i: 'orders', items: [['/orders', 'ออเดอร์ทั้งหมด'], ['/reports', 'แจ้งปัญหา'], ['/renewals', 'ต่อเมล'], ['/otp', 'ค้นหา OTP']] },
  { k: 'money', l: 'การเงิน', i: 'payments', items: [['/payments', 'การชำระเงิน'], ['/accounting', 'บัญชี']] },
  { k: 'customers', l: 'ลูกค้า', i: 'customers', items: [['/customers', 'ลูกค้าทั้งหมด'], ['/agents', 'ตัวแทน']] },
  { k: 'settings', l: 'ตั้งค่า', i: 'settings', items: [['/settings', 'ตั้งค่าร้าน'], ['/line-bot', 'บอท LINE'], ['/resize', 'ย่อรูป']] },
];
/** หน้าที่ทุกคนในหลังบ้านใช้ได้ (ไม่ผูกสิทธิ์) */
const OPEN = new Set(['/resize']);
const TITLE: Record<string, string> = Object.fromEntries(GROUPS.flatMap((g) => g.items.map(([h, l]) => [h, g.items.length > 1 && h === g.items[0][0] ? g.l : l])));
const groupOf = (h: string) => GROUPS.find((g) => g.items.some(([x]) => x === h)) ?? GROUPS[0];

/** โครงหลังบ้าน: แถบซ้าย + แถบบน + เมนูล่าง (มือถือ) */
export function AdminNav({ shop, counts, slip, plan, perms, staff = false, children }: {
  shop: { name: string; slug: string; logo: string; expires: string | null }; counts: { orders: number };
  slip: { used: number; quota: number; overage: number }; plan: string; perms: string[]; staff?: boolean; children: React.ReactNode;
}) {
  const path = fromPublic(usePathname() ?? '/');
  // เมนูที่เข้าได้ (เจ้าของร้าน = ทุกเมนู · แอดมิน = ตามสิทธิ์) — key ของสิทธิ์ = path เมนู ('' = ภาพรวม)
  // + แพ็กเกจของร้านต้องมีฟีเจอร์นั้น (ใช้ไม่ได้ = ซ่อนเมนูไปเลย ไม่แสดงแบบติดกุญแจ)
  const allowed = ([h]: [string, ...string[]]) => OPEN.has(h) || (perms.includes(PERM_OF[h] ?? '') && (!LOCKS[h] || can(plan, LOCKS[h])));
  const cur = path.replace(/^\/admin/, '').split('/').slice(0, 2).join('/');
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.some(([h]) => !OPEN.has(h)));
  const group = groupOf(cur);
  const tabs = groups.find((g) => g.k === group.k)?.items ?? [];
  const badge = (h: string) => (h === '/orders' ? queue : h === '/reports' ? reports : 0);
  // ตัวนับสลิป: layout ไม่โหลดใหม่ตอนเปลี่ยนเมนู → ดึงตัวเลขใหม่เองทุกครั้งที่เปลี่ยนหน้า
  const [used, setUsed] = useState(slip.used);
  const [reports, setReports] = useState(0);
  const [queue, setQueue] = useState(counts.orders);
  useEffect(() => { api<{ used: number; reports: number; queue: number }>('/api/admin/slip-usage', undefined, 'GET').then((r) => { if (r.ok) { setUsed(r.data.used); setReports(r.data.reports ?? 0); setQueue(r.data.queue ?? 0); } }); }, [path]);
  const pct = Math.min(100, Math.round((used / Math.max(1, slip.quota)) * 100));
  const gBadge = (g: Group) => g.items.reduce((n, [h]) => n + badge(h), 0);
  const gLink = (g: Group, size?: number) => (
    <Link key={g.k} href={to(`/admin${g.items[0][0]}`)} className={group.k === g.k ? 'on' : ''} aria-current={group.k === g.k ? 'page' : undefined}>
      <Icon name={g.i} size={size} />{g.l}{gBadge(g) > 0 && <span className="count">{gBadge(g)}</span>}
    </Link>
  );
  const logout = async () => { await Promise.all([api('/api/admin/login', { logout: true }), api('/api/auth/logout')]); window.location.href = to('/admin'); }; // /admin ตรง ๆ ถูกซ่อนไว้ ต้องใช้ลิงก์สาธารณะ
  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          {shop.logo ? <img src={shop.logo} alt="" className="mark" style={{ objectFit: 'cover' }} /> : <span className="mark">{shop.name.slice(0, 1).toUpperCase()}</span>}
          <div><b>{shop.name}</b><small>{shop.slug}.sysrent.shop</small></div>
        </div>
        {staff && <div className="staff-badge">🛡️ คุณเข้าในฐานะแอดมิน · เห็นเฉพาะเมนูที่เจ้าของร้านเปิดให้</div>}
        <nav className="nav"><div>{groups.map((g) => gLink(g))}</div></nav>
        <div className="side-foot">
          {/* ราคาที่จ่ายจริงอยู่ที่เว็บหลัก (มีทั้งทดลอง / โปร) → แสดงแค่วันหมดอายุ ไม่แสดงราคา */}
          <div className="plan-row"><span className="pill accent">แพ็กเกจ {PLAN_LABEL[isPlan(plan) ? plan : 'max']}</span>{shop.expires && <span className="muted">ถึง {new Date(shop.expires).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' })}</span>}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>ตรวจสลิปเดือนนี้</b><span className="num">{used}{slip.quota > 0 ? ` / ${slip.quota}` : ' ครั้ง'}</span></div>
          {slip.quota > 0 && <div className={`meter${pct >= 80 ? ' warn' : ''}`}><i style={{ width: `${pct}%` }} /></div>}
          <span className="muted" style={{ fontSize: 12 }}>{slip.quota > 0 ? `ฟรี ${slip.quota} ครั้ง/เดือน · เกินคิด ` : 'จ่ายตามจริง '}฿{slip.overage.toFixed(2)}/สลิป ตัดจากกระเป๋า SysRent</span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <nav className="crumbs" aria-label="ตำแหน่ง">
            <span className="crumb-ic"><Icon name={group.i} size={17} /></span>
            {cur && <><Link href={to('/admin')} className="crumb-root">หลังบ้าน</Link><svg className="crumb-sep" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg></>}
            <b>{TITLE[cur] ?? 'ภาพรวม'}</b>
          </nav>
          <NavSearch menu={groups.flatMap((g) => g.items.map(([h, l]) => ({ href: h, label: g.items.length > 1 && h === g.items[0][0] ? g.l : l, where: g.l })))} />
          <div className="acts">
            <TutorialButton page={cur} />
            <a href="/" className="btn sm" target="_blank" rel="noopener noreferrer"><span className={css.full}>ดูหน้าร้าน</span><span className={css.short}>ร้าน</span> ↗</a>
            <button type="button" className="btn ghost sm" onClick={logout} aria-label="ออกจากระบบ" title="ออกจากระบบ"><span className={css.full}>ออกจากระบบ</span><span className={css.short} aria-hidden>⎋</span></button>
          </div>
        </header>
        <div className="content">
          {tabs.length > 1 && (
            <nav className={css.subtabs} aria-label={`เมนู${group.l}`}>
              {tabs.map(([h, l]) => <Link key={h} href={to(`/admin${h}`)} className={cur === h ? css.on : ''} aria-current={cur === h ? 'page' : undefined}>{l}{badge(h) > 0 && <span className={css.n}>{badge(h)}</span>}</Link>)}
            </nav>
          )}
          {children}
        </div>
      </div>
      <nav className={`mnav${groups.length >= 6 ? ` ${css.six}` : ''}`} aria-label="เมนูหลังบ้าน" style={groups.length < 5 ? { gridTemplateColumns: `repeat(${groups.length}, 1fr)` } : undefined}>
        {groups.map((g) => gLink(g, 22))}
      </nav>
    </div>
  );
}
