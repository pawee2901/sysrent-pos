import { to } from '@/lib/routes';
import Link from 'next/link';
import { getAgent, agentPrices, withAgentPrices } from '@/lib/agents';
import { getCustomer } from '@/lib/auth';
import { mergeCategories, shopCategories } from '@/lib/categories';
import { getShop, baht } from '@/lib/shop';
import { loadProducts, type Product } from '@/lib/catalog';
import { db } from '@/lib/db';
import { AppLogo } from '@/components/AppLogo';

export const dynamic = 'force-dynamic';

const mask = (u: string) => (u.length <= 2 ? u[0] + '*' : `${u[0]}***${u[u.length - 1]}`);
const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m} นาทีที่แล้ว` : m < 1440 ? `${Math.round(m / 60)} ชม.ที่แล้ว` : `${Math.round(m / 1440)} วันที่แล้ว`;
};

function Card({ p }: { p: Product }) {
  const compare = Math.max(0, ...p.options.map((o) => o.compareAt ?? 0));
  return (
    <Link href={to(`/p/${p.id}`)} className={`card pcard${p.inStock ? '' : ' out'}`}>
      <div className="pcard-img"><AppLogo image={p.image} template={p.template} name={p.name} size="xl" />{p.badge && <span className="pill accent plain tag">{p.badge}</span>}</div>
      <div className="pcard-body">
        <span className="pcard-name">{p.name}</span>
        <span className="pcard-price">{p.from !== null && <>{p.options.length > 1 && <small>เริ่ม </small>}{baht(p.from)}</>}{compare > (p.from ?? 0) && <s className="faint" style={{ fontSize: 13, marginLeft: 6, fontWeight: 400 }}>{baht(compare)}</s>}</span>
        <span className="pcard-meta"><span>{p.left === null ? 'พร้อมส่ง' : p.left ? `เหลือ ${p.left}` : 'หมด'}</span><span>ขายแล้ว {p.sold.toLocaleString('th-TH')}</span></span>
      </div>
    </Link>
  );
}

/** หน้าแรกร้าน: หัวเว็บ · ความเคลื่อนไหวจริง · ตัวเลข · หมวด · สินค้า · ขั้นตอนซื้อ */
export default async function Home({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const shop = (await getShop())!;
  const { c = '', q = '' } = await searchParams;
  const d = db();
  const [all, { count: members }, { data: recent }, me, { data: pc }] = await Promise.all([
    loadProducts(shop.id),
    d.from('shop_customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
    d.from('shop_orders').select('paid_at, shop_customers(username), shop_order_items(name)').eq('shop_id', shop.id).not('paid_at', 'is', null).order('paid_at', { ascending: false }).limit(4),
    getCustomer(),
    d.from('shops').select('promo_cards').eq('id', shop.id).maybeSingle(), // ยังไม่รัน 0031 = ไม่แสดงกล่องรูป
  ]);
  const promos = (Array.isArray(pc?.promo_cards) ? pc.promo_cards as { image?: string; link?: string }[] : []).filter((x) => x.image);
  // ตัวแทน (ร้าน Pro): เห็นราคาตัวแทน · ราคาปกติขีดฆ่า
  const agent = await getAgent(shop, me?.id);
  const products = agent ? withAgentPrices(all, await agentPrices(all.flatMap((p) => p.options.map((o) => o.id)))) : all;
  // ปุ่มหมวด: เรียงตามที่ร้านตั้ง · แสดงเฉพาะหมวดที่มีสินค้า
  const used = new Set(products.map((p) => p.category).filter(Boolean));
  const cats = mergeCategories(await shopCategories(shop.id), [...used]).filter((x) => used.has(x));
  const term = q.trim().toLowerCase();
  const shown = products.filter((p) => (!c || p.category === c) && (!term || p.name.toLowerCase().includes(term)));
  const sold = products.reduce((s, p) => s + p.sold, 0);
  const ready = products.reduce((s, p) => s + (p.left ?? 0), 0);
  type R = { paid_at: string; shop_customers: { username: string } | null; shop_order_items: { name: string }[] };
  const live = ((recent ?? []) as unknown as R[]).map((r) => ({ who: r.shop_customers ? `@${mask(r.shop_customers.username)}` : 'ลูกค้า', what: (r.shop_order_items[0]?.name ?? 'สินค้า').split(' · ')[0], when: ago(r.paid_at) }));

  return (
    <>
      {/* ร้านอัปรูปหน้าแรกไว้ = แสดงรูปแทนกล่องข้อความ (ไม่ครอปรูป ข้อความในรูปไม่โดนตัด) */}
      {shop.banner_url ? (shop.banner_link
        ? <a href={shop.banner_link} className="banner"><img src={shop.banner_url} alt={shop.name} /></a>
        : <div className="banner"><img src={shop.banner_url} alt={shop.name} /></div>) : (
      <section className={`hero${products.length ? '' : ' solo'}`}>
        <div>
          <span className="pill accent plain">✨ ส่งอัตโนมัติ 24 ชั่วโมง</span>
          <h1 style={{ marginTop: 12 }}>{shop.tagline.includes(' ') ? <>{shop.tagline.split(' ').slice(0, -1).join(' ')}<br /><em>{shop.tagline.split(' ').slice(-1)}</em></> : shop.tagline}</h1>
          <p>สแกนจ่ายพร้อมเพย์ ระบบตรวจสลิปและส่งรหัสให้เองภายในไม่กี่วินาที มีปัญหาทักร้านได้ตลอด</p>
          <div className="hero-acts"><a href="#cat" className="btn primary lg">เลือกซื้อเลย</a><Link href={to('/orders')} className="btn lg">ประวัติการซื้อ</Link></div>
          <div className="hero-ticks"><span>ตรวจสลิปอัตโนมัติ</span><span>รับประกันตลอดอายุ</span><span>ดูแลทาง LINE</span></div>
        </div>
        {products.length > 0 && <div className="hero-art">{products.slice(0, 6).map((p) => <AppLogo key={p.id} image={p.image} template={p.template} name={p.name} />)}</div>}
      </section>)}
      {promos.length > 0 && (
        <div className="promos">{promos.map((x, i) => x.link
          ? <a key={i} href={x.link} className="promo"><img src={x.image} alt="" loading={i > 3 ? 'lazy' : undefined} /></a>
          : <div key={i} className="promo"><img src={x.image} alt="" loading={i > 3 ? 'lazy' : undefined} /></div>)}</div>
      )}
      {live.length > 0 && (
        <div className="live"><span className="live-dot" />{live.map((l, i) => <span key={i}>{i > 0 && <span className="faint">• </span>}<b>{l.who}</b> ซื้อ {l.what} · {l.when}</span>)}</div>
      )}
      <div className="stats">
        <div className="card stat"><b className="num">{(members ?? 0).toLocaleString('th-TH')}</b><span>สมาชิก</span></div>
        <div className="card stat"><b className="num">{sold.toLocaleString('th-TH')}</b><span>ขายไปแล้ว</span></div>
        <div className="card stat"><b className="num">{ready.toLocaleString('th-TH')}</b><span>พร้อมส่งตอนนี้</span></div>
      </div>
      <section className="sec" id="cat">
        <div className="sec-head"><h2>{term ? `ผลการค้นหา "${q}"` : 'สินค้าทั้งหมด'}</h2><span className="muted" style={{ fontSize: 14 }}>{shown.length} รายการ</span></div>
        {cats.length > 1 && (
          <div className="chips" style={{ marginBottom: 14 }}>
            <Link href="/#cat" className={`chip${c ? '' : ' on'}`}>ทั้งหมด</Link>
            {cats.map((x) => <Link key={x} href={`/?c=${encodeURIComponent(x)}#cat`} className={`chip${x === c ? ' on' : ''}`}>{x}</Link>)}
          </div>
        )}
        {shown.length ? <div className="grid">{shown.map((p) => <Card key={p.id} p={p} />)}</div>
          : <div className="card success"><p className="muted">{products.length ? 'ไม่พบสินค้าที่ค้นหา' : 'ร้านกำลังเตรียมสินค้า แวะมาใหม่เร็ว ๆ นี้นะ'}</p></div>}
      </section>
      <section className="sec">
        <div className="sec-head"><h2>ซื้อง่าย 3 ขั้นตอน</h2></div>
        <div className="how">
          <div className="card"><span className="how-n">1</span><div><b>เลือกแอปและแพ็กเกจ</b><span>มีให้เลือกหลายระยะเวลา</span></div></div>
          <div className="card"><span className="how-n">2</span><div><b>สแกนจ่ายพร้อมเพย์</b><span>อัปสลิป ระบบตรวจให้อัตโนมัติ</span></div></div>
          <div className="card"><span className="how-n">3</span><div><b>ได้รหัสทันที</b><span>ดูได้ที่ &quot;บัญชีของฉัน&quot; ตลอดอายุ</span></div></div>
        </div>
      </section>
    </>
  );
}
