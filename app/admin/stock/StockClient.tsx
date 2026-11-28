'use client';
import { useState } from 'react';
import { AppLogo } from '@/components/AppLogo';
import { baht } from '@/components/Cart';
import type { DForm } from '../products/DeliveryForm';
import { StockModal, type OtpInfo } from '../products/StockModal';
import css from '../products/dform.module.css';

type P = { id: string; name: string; category: string; image: string; template: string; active: boolean; preorder: boolean; options: { id: string; name: string; days: string; stock: number; price: number; active: boolean }[] };

/** แอปของสินค้า = หมวดที่ตั้งไว้ (ไม่มีหมวด = ชื่อสินค้า) */
const appOf = (p: P) => p.category || p.name;

/** หน้าสต็อก: สินค้าส่งอัตโนมัติทั้งหมด · แพ็กเกจละแถว · เหลือเท่าไหร่ · กดเติม */
export function StockClient({ products, forms, otp, limits }: { products: P[]; forms: Record<string, DForm>; otp: OtpInfo; limits: Record<string, number> }) {
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'low'>('all');
  const [app, setApp] = useState(''); // แยกตามแอป (หมวดสินค้า) · '' = ทุกแอป
  const [open, setOpen] = useState<{ pid: string; oid: string } | null>(null);
  const k = q.trim().toLowerCase();
  const shown = products
    .filter((p) => !k || p.name.toLowerCase().includes(k) || p.options.some((o) => o.name.toLowerCase().includes(k)))
    .filter((p) => only === 'all' || p.options.some((o) => o.active && o.stock <= 3))
    .filter((p) => !app || appOf(p) === app);
  // แอป (หมวด) ทั้งหมด + จำนวนชิ้นในสต็อกของแต่ละแอป
  const apps = [...products.reduce((m, p) => { const k = appOf(p); m.set(k, (m.get(k) ?? 0) + p.options.reduce((s, o) => s + o.stock, 0)); return m; }, new Map<string, number>())];
  const groups = [...new Set(shown.map((p) => appOf(p)))];
  const empty = products.reduce((n, p) => n + p.options.filter((o) => o.active && !o.stock).length, 0);
  const total = products.reduce((n, p) => n + p.options.reduce((m, o) => m + o.stock, 0), 0);
  const cur = open ? products.find((p) => p.id === open.pid) : undefined;

  return (
    <>
      <div className="page-head"><div><h1>สต็อก</h1><p>ของที่ระบบส่งให้ลูกค้าอัตโนมัติ · กดแพ็กเกจเพื่อเติม / ดูของในสต็อก</p></div></div>
      <div className="kpis">
        <div className="card kpi"><span className="lbl">พร้อมส่งทั้งหมด</span><span className="val num">{total.toLocaleString('th-TH')}</span><span className="delta mute">ชิ้น</span></div>
        <div className="card kpi"><span className="lbl">แพ็กเกจที่ของหมด</span><span className="val num">{empty}</span><span className={`delta${empty ? ' down' : ' mute'}`}>{empty ? 'ลูกค้าซื้อไม่ได้' : 'ครบทุกแพ็กเกจ 👍'}</span></div>
      </div>
      <div className={css.sTools}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นหาสินค้า / แพ็กเกจ" />
        <div className={css.mini}>
          <button type="button" className={only === 'all' ? css.on : ''} onClick={() => setOnly('all')}>ทั้งหมด</button>
          <button type="button" className={only === 'low' ? css.on : ''} onClick={() => setOnly('low')}>ใกล้หมด / หมด</button>
        </div>
      </div>
      {apps.length > 1 && (
        <nav className="set-tabs" aria-label="แยกตามแอป">
          <button type="button" className={!app ? 'on' : ''} onClick={() => setApp('')}>ทุกแอป</button>
          {apps.map(([k, n]) => <button key={k} type="button" className={app === k ? 'on' : ''} onClick={() => setApp(k)}>{k} <span className={`pill ${n ? 'plain' : 'bad'}`}>{n}</span></button>)}
        </nav>
      )}
      {!products.length ? <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>ยังไม่มีสินค้าแบบส่งอัตโนมัติ · เพิ่มสินค้าที่เมนู &quot;สินค้าทั้งหมด&quot; แล้วเลือกวิธีส่งของเป็น &quot;ส่งอัตโนมัติ&quot;</p></div> : (
        <div className={css.sGroups}>{groups.map((g) => (
        <section key={g} className={css.sGroup}>
          {groups.length > 1 && <h2 className={css.sGroupH}>{g}<small>{shown.filter((p) => appOf(p) === g).reduce((s, p) => s + p.options.reduce((m, o) => m + o.stock, 0), 0)} ชิ้น</small></h2>}
        <div className={css.sList}>
          {shown.filter((p) => appOf(p) === g).map((p) => (
            <section key={p.id} className={`card ${css.sCard}`} style={{ opacity: p.active ? 1 : .6 }}>
              <div className={css.sHead}><AppLogo image={p.image} template={p.template} name={p.name} /><b>{p.name}</b>{!p.active && <span className="pill plain">ปิดขาย</span>}{p.preorder && <span className="pill accent plain">พรีออเดอร์</span>}</div>
              {!p.options.length ? <p className="muted" style={{ margin: 0, fontSize: 13 }}>ยังไม่มีแพ็กเกจ</p> : p.options.map((o) => (
                <button key={o.id} type="button" className={css.sRow} onClick={() => setOpen({ pid: p.id, oid: o.id })} style={{ opacity: o.active ? 1 : .55 }}>
                  <span className={css.sName}><b>{o.name}</b><small>{baht(o.price)}{!o.active ? ' · ปิดอยู่' : ''}</small></span>
                  <span className={`${css.sLeft}${!o.stock ? ` ${css.zero}` : o.stock <= 3 ? ` ${css.low}` : ''}`}>{o.stock ? `${o.stock.toLocaleString('th-TH')} ชิ้น` : 'หมด'}</span>
                  <span className={css.sAdd}>＋ เติม</span>
                </button>
              ))}
            </section>
          ))}
        </div>
        </section>))}
          {!shown.length && <p className="muted">ไม่พบสินค้าที่ค้นหา</p>}
        </div>
      )}
      {cur && open && (
        <StockModal product={{ id: cur.id, name: cur.name, options: cur.options.map((o) => ({ id: o.id, name: o.name, days: o.days, stock: o.stock })) }}
          optionId={open.oid} forms={forms} otp={otp} limits={limits} onClose={() => setOpen(null)}
          targets={products.flatMap((p) => p.options.map((o) => ({ id: o.id, label: `${p.name} · ${o.name}` })))} />
      )}
    </>
  );
}
