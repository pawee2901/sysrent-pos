import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getShop, baht, shopOpen } from '@/lib/shop';
import { loadProducts } from '@/lib/catalog';
import { getAgent, agentPrices, withAgentPrices } from '@/lib/agents';
import { getCustomer } from '@/lib/auth';
import { AppLogo } from '@/components/AppLogo';
import { ProductGallery } from '@/components/ProductGallery';
import { productMedia } from '@/lib/media';
import { BuyBox } from './BuyBox';
import { productReviews } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const shop = (await getShop())!;
  const [[base], me] = await Promise.all([loadProducts(shop.id, { id }), getCustomer()]);
  if (!base) notFound();
  // ตัวแทน (ร้าน Pro): ราคาตัวแทน (ราคาปกติขีดฆ่า) — ราคาจริงคิดในฐานข้อมูลตอนสั่ง
  const agent = await getAgent(shop, me?.id);
  const p = agent ? withAgentPrices([base], await agentPrices(base.options.map((o) => o.id)))[0] : base;
  const [media, rv] = await Promise.all([productMedia({ ids: [p.id] }), productReviews(p.id)]);
  const gallery = media.map.get(p.id)?.images ?? [];
  const cover = <AppLogo image={p.image} template={p.template} name={p.name} size="xl" />;
  return (
    <>
      <nav className="crumb" aria-label="เส้นทาง"><Link href="/">หน้าแรก</Link><i>›</i>{p.category && <><span>{p.category}</span><i>›</i></>}<b>{p.name}</b></nav>
      <div className="pd">
        {gallery.length ? <ProductGallery cover={cover} images={gallery} name={p.name} /> : <div className="card pd-media">{cover}</div>}
        <div>
          {p.badge && <span className="pill accent plain">{p.badge}</span>}
          {agent && <span className="pill ok" style={{ marginLeft: p.badge ? 6 : 0 }}>🤝 ราคาตัวแทน</span>}
          <h1>{p.name}</h1>
          <div className="pd-sub">
            {p.rating && <a href="#reviews" className="pd-rate">★ {p.rating.avg.toFixed(1)} <small>({p.rating.count} รีวิว)</small></a>}
            <span>ขายแล้ว {p.sold.toLocaleString('th-TH')}</span>
            {p.inStock ? <span className="pill ok">{p.left === null ? 'พร้อมส่ง' : `พร้อมส่ง ${p.left}`}</span> : p.preorder ? <span className="pill warn">📦 เปิดพรีออเดอร์</span> : <span className="pill bad">หมดชั่วคราว</span>}
            {p.from !== null && <span>เริ่ม {baht(p.from)}</span>}
          </div>
          <BuyBox open={shopOpen(shop)} product={{ id: p.id, name: p.name, image: p.image, template: p.template, fulfillment: p.fulfillment, askInfo: p.askInfo }} options={p.options} preorder={p.preorder ? { note: p.preorderNote } : null}>
            {/* รายละเอียดอยู่เหนือปุ่ม ใส่ตะกร้า / ซื้อเลย → อ่านเงื่อนไขก่อนกดซื้อ */}
            {p.description && <div className="card desc"><h3>รายละเอียด</h3><p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{p.description}</p></div>}
          </BuyBox>
          <div className="perks">
            <div className="card perk"><i>⚡</i><span>{p.fulfillment === 'manual' ? 'สินค้าสั่งทำ: จ่ายแล้วร้านทำให้ รับของได้ที่หน้าประวัติการซื้อ' : !p.inStock && p.preorder ? 'พรีออเดอร์: จองแล้วระบบส่งรหัสให้เองทันทีที่ร้านเติมของ (จองก่อนได้ก่อน)' : 'จ่ายแล้วได้รหัสทันที ไม่ต้องรอแอดมิน'}</span></div>
            <div className="card perk"><i>🛡️</i><span>รับประกันตลอดอายุแพ็กเกจ</span></div>
            <div className="card perk"><i>🔑</i><span>ดูรหัสได้เองที่ &quot;บัญชีของฉัน&quot;</span></div>
          </div>
        </div>
      </div>
      <section className="sec pd-reviews" id="reviews">
        <div className="sec-head"><h2>รีวิวจากผู้ซื้อจริง</h2>{p.rating && <span className="muted" style={{ fontSize: 14 }}>{p.rating.count} รีวิว</span>}</div>
        {p.rating ? (
          <div className="rv-wrap">
            <div className="card rv-sum">
              <b className="num">{p.rating.avg.toFixed(1)}</b>
              <span className="rv-big">{'★'.repeat(Math.round(p.rating.avg))}<i>{'★'.repeat(5 - Math.round(p.rating.avg))}</i></span>
              <small className="muted">จาก {p.rating.count} รีวิว</small>
              <div className="rv-bars">{[5, 4, 3, 2, 1].map((n) => {
                const c = rv.dist[n - 1], pct = p.rating ? Math.round((c / p.rating.count) * 100) : 0;
                return <div key={n}><span>{n}★</span><div><i style={{ width: `${pct}%` }} /></div><small>{c}</small></div>;
              })}</div>
            </div>
            <div className="rv-list">{rv.list.map((r) => (
              <article key={r.id} className="card rv-item">
                <div className="rv-top"><span className="rv-av">{r.who.slice(0, 1).toUpperCase()}</span><b>{r.who}</b><span className="rv-st">{'★'.repeat(r.stars)}<i>{'★'.repeat(5 - r.stars)}</i></span><small className="muted">{r.when}</small></div>
                {r.body && <p>{r.body}</p>}
                {r.reply && <div className="rv-reply"><b>💬 ร้านตอบ</b><p>{r.reply}</p></div>}
              </article>))}</div>
          </div>
        ) : <div className="card rv-empty"><span>⭐</span><p className="muted">ยังไม่มีรีวิว · ซื้อแล้วให้คะแนนได้ที่หน้าประวัติการซื้อ</p></div>}
      </section>
    </>
  );
}
