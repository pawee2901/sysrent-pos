import { to } from '@/lib/routes';
import { Fragment } from 'react';
import Link from 'next/link';
import { getAgent, agentPrices, withAgentPrices } from '@/lib/agents';
import { getCustomer } from '@/lib/auth';
import { mergeCategories, shopCategories } from '@/lib/categories';
import { getShop, baht } from '@/lib/shop';
import { loadProducts, type Product } from '@/lib/catalog';
import { db } from '@/lib/db';
import { AppLogo } from '@/components/AppLogo';
import { HALF_OK, SOCIAL, blockStyle, youtubeId, type Block } from '@/lib/home-layout';
import { CouponBox, Countdown, Slider } from '@/components/HomeBits';
import { shopContacts } from '@/lib/contacts-server';
import { CONTACT_KINDS, contactHref } from '@/lib/contacts';

const mask = (u: string) => (u.length <= 2 ? u[0] + '*' : `${u[0]}***${u[u.length - 1]}`);
const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m} นาทีที่แล้ว` : m < 1440 ? `${Math.round(m / 60)} ชม.ที่แล้ว` : `${Math.round(m / 1440)} วันที่แล้ว`;
};

function Card({ p }: { p: Product }) {
  const compare = Math.max(0, ...p.options.map((o) => o.compareAt ?? 0));
  return (
    <Link href={to(`/p/${p.id}`)} className={`card pcard${p.inStock || p.preorder ? '' : ' out'}`}>
      <div className="pcard-img"><AppLogo image={p.image} template={p.template} name={p.name} size="xl" />{!p.inStock && p.preorder ? <span className="pill warn tag">📦 พรีออเดอร์</span> : p.badge && <span className="pill accent plain tag">{p.badge}</span>}</div>
      <div className="pcard-body">
        <span className="pcard-name">{p.name}</span>
        <span className="pcard-price">{p.from !== null && <>{p.options.length > 1 && <small>เริ่ม </small>}{baht(p.from)}</>}{compare > (p.from ?? 0) && <s className="faint" style={{ fontSize: 13, marginLeft: 6, fontWeight: 400 }}>{baht(compare)}</s>}</span>
        <span className="pcard-meta"><span>{p.left === null ? 'พร้อมส่ง' : p.left ? `เหลือ ${p.left}` : p.preorder ? 'เปิดจอง' : 'หมด'}</span><span>ขายแล้ว {p.sold.toLocaleString('th-TH')}</span></span>
      </div>
    </Link>
  );
}

const Stars = ({ n = 5 }: { n?: number }) => <span className="hb-stars" aria-label={`${n} ดาว`}>{'★'.repeat(n)}<i>{'★'.repeat(5 - n)}</i></span>;

/** แสดงกล่องที่ร้านจัดไว้ (หน้าแรก + หน้าเพิ่มเติม) · c / q = หมวด / คำค้นของกล่องสินค้าทั้งหมด */
export async function Blocks({ blocks: input, c = '', q = '' }: { blocks: Block[]; c?: string; q?: string }) {
  const shop = (await getShop())!;
  const d = db();
  const [all, { count: members }, { data: recent }, me, { data: pc }] = await Promise.all([
    loadProducts(shop.id),
    d.from('shop_customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
    d.from('shop_orders').select('paid_at, shop_customers(username), shop_order_items(name)').eq('shop_id', shop.id).not('paid_at', 'is', null).order('paid_at', { ascending: false }).limit(10),
    getCustomer(),
    d.from('shops').select('promo_cards').eq('id', shop.id).maybeSingle(), // ยังไม่รัน 0031 = ไม่แสดงกล่องรูป
  ]);
  const layout = input.filter((b) => b.on);
  const contacts = layout.some((b) => b.type === 'contact') ? await shopContacts(shop) : [];
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
  const live = ((recent ?? []) as unknown as R[]).map((r) => {
    const u = r.shop_customers?.username ?? '';
    const items = r.shop_order_items.map((x) => x.name);
    return {
      who: u ? `@${mask(u)}` : 'ลูกค้า', what: (items[0] ?? 'สินค้า').split(' · ')[0], when: ago(r.paid_at),
      // การ์ดกิจกรรม: ตัวแรกของชื่อ + จุดปิดที่เหลือ · ชื่อสินค้าเต็ม (หลายชิ้น = + อีก n)
      dots: u ? `${u[0]}${'•'.repeat(Math.min(10, Math.max(3, u.length - 1)))}` : 'ลูกค้า', initial: (u[0] ?? '?').toUpperCase(),
      full: `${items[0] ?? 'สินค้า'}${items.length > 1 ? ` + อีก ${items.length - 1}` : ''}`,
    };
  });

  const builtin: Record<string, React.ReactNode> = {
    hero: (shop.banner_url ? (shop.banner_link
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
      </section>)),
    promos: promos.length > 0 && (
        <div className="promos">{promos.map((x, i) => x.link
          ? <a key={i} href={x.link} className="promo"><img src={x.image} alt="" loading={i > 3 ? 'lazy' : undefined} /></a>
          : <div key={i} className="promo"><img src={x.image} alt="" loading={i > 3 ? 'lazy' : undefined} /></div>)}</div>
      ),
    live: null, // แสดงตามแบบที่เลือก (ดู render)
    stats: (<div className="stats">
        <div className="card stat"><b className="num">{(members ?? 0).toLocaleString('th-TH')}</b><span>สมาชิก</span></div>
        <div className="card stat"><b className="num">{sold.toLocaleString('th-TH')}</b><span>ขายไปแล้ว</span></div>
        <div className="card stat"><b className="num">{ready.toLocaleString('th-TH')}</b><span>พร้อมส่งตอนนี้</span></div>
      </div>),
    products: (<section className="sec" id="cat">
        <div className="sec-head"><h2>{term ? `ผลการค้นหา "${q}"` : 'สินค้าทั้งหมด'}</h2><span className="muted" style={{ fontSize: 14 }}>{shown.length} รายการ</span></div>
        {cats.length > 1 && (
          <div className="chips" style={{ marginBottom: 14 }}>
            <Link href="/#cat" className={`chip${c ? '' : ' on'}`}>ทั้งหมด</Link>
            {cats.map((x) => <Link key={x} href={`/?c=${encodeURIComponent(x)}#cat`} className={`chip${x === c ? ' on' : ''}`}>{x}</Link>)}
          </div>
        )}
        {shown.length ? <div className="grid">{shown.map((p) => <Card key={p.id} p={p} />)}</div>
          : <div className="card success"><p className="muted">{products.length ? 'ไม่พบสินค้าที่ค้นหา' : 'ร้านกำลังเตรียมสินค้า แวะมาใหม่เร็ว ๆ นี้นะ'}</p></div>}
      </section>),
    how: (<section className="sec">
        <div className="sec-head"><h2>ซื้อง่าย 3 ขั้นตอน</h2></div>
        <div className="how">
          <div className="card"><span className="how-n">1</span><div><b>เลือกแอปและแพ็กเกจ</b><span>มีให้เลือกหลายระยะเวลา</span></div></div>
          <div className="card"><span className="how-n">2</span><div><b>สแกนจ่ายพร้อมเพย์</b><span>อัปสลิป ระบบตรวจให้อัตโนมัติ</span></div></div>
          <div className="card"><span className="how-n">3</span><div><b>ได้รหัสทันที</b><span>ดูได้ที่ &quot;บัญชีของฉัน&quot; ตลอดอายุ</span></div></div>
        </div>
      </section>),
  };
  // ลูกค้าค้นหา / กดหมวด แต่ร้านซ่อนกล่องสินค้าไว้ = แสดงผลค้นหาไว้บนสุด
  const blocks: Block[] = (term || c) && !layout.some((b) => b.type === 'products') ? [{ id: 'products', type: 'products', on: true }, ...layout] : layout;
  const pickOf = (b: Block) => {
    const lim = Math.min(24, Math.max(1, b.limit ?? 4));
    if (b.pick === 'ids') return (b.ids ?? []).map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p).slice(0, lim);
    const pool = b.pick === 'cat' ? products.filter((p) => p.category === b.category) : [...products].sort((a, z) => z.sold - a.sold);
    return pool.slice(0, lim);
  };
  const go = (href: string | undefined, cls: string, inner: React.ReactNode) => href
    ? (href.startsWith('/') ? <Link href={href} className={cls}>{inner}</Link> : <a href={href} className={cls} target="_blank" rel="noopener noreferrer">{inner}</a>)
    : <div className={cls}>{inner}</div>;
  function render(b: Block): React.ReactNode {
    if (b.type === 'live') {
      const list = live.slice(0, Math.min(10, Math.max(3, b.limit ?? (b.variant === 'feed' ? 5 : 4))));
      if (!list.length) return null;
      if (b.variant === 'feed') return (
        <section className="hb hb-feed">
          <div className="hb-feed-head"><div>{(b.label ?? 'STORE FEED') && <small>{b.label ?? 'STORE FEED'}</small>}<h2>{b.title || 'กิจกรรมล่าสุด'}</h2>{b.text && <p>{b.text}</p>}</div>{(b.badge ?? 'อัปเดตสด') && <span className="hb-feed-live"><i />{b.badge ?? 'อัปเดตสด'}</span>}</div>
          <ul>{list.map((l, i) => <li key={i}><span className="hb-feed-av">{l.initial}</span><span className="hb-feed-txt"><b>{l.dots}</b> ซื้อ {l.full}</span><time>{l.when}</time></li>)}</ul>
        </section>);
      if (b.variant === 'ticker') return (
        <div className="hb hb-marquee hb-ticker" aria-label="ลูกค้าที่เพิ่งซื้อ"><div aria-hidden>{[0, 1].map((k) => <span key={k}>{list.map((l) => `🟢 ${l.who} ซื้อ ${l.what} · ${l.when}`).join('     ')}</span>)}</div></div>);
      return <div className="live"><span className="live-dot" />{list.slice(0, 4).map((l, i) => <span key={i}>{i > 0 && <span className="faint">• </span>}<b>{l.who}</b> ซื้อ {l.what} · {l.when}</span>)}</div>;
    }
    if (b.type in builtin) return builtin[b.type];
    if (b.type === 'featured') {
      const list = pickOf(b);
      if (!list.length) return null;
      const body = b.variant === 'list'
        ? <div className="card hb-plist">{list.map((p) => <Link key={p.id} href={to(`/p/${p.id}`)}><AppLogo image={p.image} template={p.template} name={p.name} /><span>{p.name}<small>{p.left === null ? 'พร้อมส่ง' : p.left ? `เหลือ ${p.left}` : 'หมด'}</small></span><b>{p.from !== null ? baht(p.from) : ''}</b></Link>)}</div>
        : <div className={b.variant === 'scroll' ? 'hb-scroll' : 'grid'}>{list.map((p) => <Card key={p.id} p={p} />)}</div>;
      return <section className="hb">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}{body}</section>;
    }
    if (b.type === 'text') return b.title || b.text ? <section className={`card hb hb-text${b.align === 'center' ? ' center' : ''}`}>{b.title && <h2>{b.title}</h2>}{b.text && <p>{b.text}</p>}</section> : null;
    if (b.type === 'image') return b.image ? go(b.link, 'hb hb-image', <img src={b.image} alt={b.title ?? ''} loading="lazy" />) : null;
    if (b.type === 'notice') return b.text ? go(b.link, `hb hb-notice ${b.tone ?? 'accent'}`, <span>{b.text}</span>) : null;
    if (b.type === 'button') return b.label ? <div className="hb hb-btn">{go(b.link, 'btn primary lg', b.label)}</div> : null;
    if (b.type === 'video') {
      const id = youtubeId(b.video);
      return id ? <section className="hb hb-video">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}<div className="hb-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title={b.title || 'วิดีโอ'} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen /></div></section> : null;
    }
    if (b.type === 'space') return <div className={`hb-space ${b.size ?? 'm'}`} aria-hidden />;
    if (b.type === 'divider') return <hr className="hb hb-hr" />;
    if (b.type === 'heading') return <div className={`hb hb-heading ${b.size ?? 'm'}${b.align === 'left' ? '' : ' center'}`}>{b.title && <h2>{b.title}</h2>}{b.text && <p>{b.text}</p>}</div>;
    if (b.type === 'slider') {
      const pics = (b.items ?? []).filter((x) => x.image) as { image: string; link?: string }[];
      return pics.length ? <Slider items={pics} /> : null;
    }
    if (b.type === 'cta') return (
      <section className={`hb hb-cta ${b.tone ?? 'accent'}${b.image ? ' pic' : ''}`} style={b.image ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.25)), url("${b.image}")` } : undefined}>
        <div>{b.title && <h2>{b.title}</h2>}{b.text && <p>{b.text}</p>}</div>
        {b.label && b.link && go(b.link, 'btn lg', b.label)}
      </section>);
    if (b.type === 'features' || b.type === 'numbers' || b.type === 'badges') {
      const list = (b.items ?? []).filter((x) => x.q);
      if (!list.length) return null;
      const cls = b.type === 'features' ? 'hb-feats' : b.type === 'numbers' ? 'hb-nums' : 'hb-badges';
      return <section className="hb">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}<div className={cls} style={{ ['--cols' as string]: b.cols ?? Math.min(4, list.length) } as React.CSSProperties}>{list.map((x, i) => (
        <div key={i} className={b.type === 'badges' ? '' : 'card'}>{x.icon && <span className="hb-ic">{x.icon}</span>}<b>{x.q}</b>{x.a && <span>{x.a}</span>}</div>))}</div></section>;
    }
    if (b.type === 'steps') {
      const list = (b.items ?? []).filter((x) => x.q);
      return list.length ? <section className="hb">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}<ol className="hb-steps">{list.map((x, i) => <li key={i} className="card"><span className="how-n">{i + 1}</span><div><b>{x.q}</b>{x.a && <span>{x.a}</span>}</div></li>)}</ol></section> : null;
    }
    if (b.type === 'reviews') {
      const list = (b.items ?? []).filter((x) => x.a || x.q);
      return list.length ? <section className="hb">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}<div className="hb-reviews">{list.map((x, i) => (
        <figure key={i} className="card"><Stars n={x.stars ?? 5} />{x.a && <blockquote>{x.a}</blockquote>}<figcaption>{x.image ? <img src={x.image} alt="" /> : <span>{(x.q || 'ล').slice(0, 1)}</span>}{x.q}</figcaption></figure>))}</div></section> : null;
    }
    if (b.type === 'pricelist') {
      const list = (b.items ?? []).filter((x) => x.q);
      return list.length ? <section className="hb">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}<div className="card hb-prices">{list.map((x, i) => <Fragment key={i}>{go(x.link, 'hb-price-row', <><span>{x.q}</span><i /><b>{x.a}</b></>)}</Fragment>)}</div>{b.text && <p className="muted" style={{ fontSize: 13 }}>{b.text}</p>}</section> : null;
    }
    if (b.type === 'marquee') return b.text ? <div className={`hb hb-marquee ${b.tone ?? 'dark'}`} aria-label={b.text}><div aria-hidden><span>{b.text}</span><span>{b.text}</span></div></div> : null;
    if (b.type === 'logos') {
      const pics = (b.items ?? []).filter((x) => x.image);
      return pics.length ? <section className="hb">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}<div className="hb-logos">{pics.map((x, i) => <div key={i}>{go(x.link, 'hb-logo', <img src={x.image} alt="" loading="lazy" />)}</div>)}</div></section> : null;
    }
    if (b.type === 'social') {
      const list = (b.items ?? []).filter((x) => x.link && x.kind);
      return list.length ? <section className="hb hb-social">{b.title && <h2>{b.title}</h2>}<div>{list.map((x, i) => {
        const s = SOCIAL[x.kind!];
        return <a key={i} href={x.link} target="_blank" rel="noopener noreferrer" style={{ background: s.color }}><span>{s.short}</span>{s.label}</a>;
      })}</div></section> : null;
    }
    if (b.type === 'spotlight') {
      const p = products.find((x) => x.id === b.ids?.[0]) ?? [...products].sort((a, z) => z.sold - a.sold)[0];
      if (!p) return null;
      return (
        <section className="card hb hb-spot">
          <div className="hb-spot-img"><AppLogo image={p.image} template={p.template} name={p.name} size="xl" /></div>
          <div>{b.title && <small className="pill accent plain">{b.title}</small>}<h2>{p.name}</h2><p>{b.text || p.description}</p>
            <div className="hb-spot-buy">{p.from !== null && <b>{p.options.length > 1 && <small>เริ่ม </small>}{baht(p.from)}</b>}<Link href={to(`/p/${p.id}`)} className="btn primary lg">{b.label || 'ซื้อเลย'}</Link></div></div>
        </section>);
    }
    if (b.type === 'quote') return b.text ? <figure className={`hb hb-quote${b.align === 'left' ? '' : ' center'}`}><blockquote>{b.text}</blockquote>{b.title && <figcaption>— {b.title}</figcaption>}</figure> : null;
    if (b.type === 'linkcards') {
      const list = (b.items ?? []).filter((x) => x.q);
      return list.length ? <section className="hb">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}<div className="hb-links" style={{ ['--cols' as string]: b.cols ?? 3 } as React.CSSProperties}>{list.map((x, i) => (
        <div key={i}>{go(x.link, 'card hb-link', <>{x.image && <img src={x.image} alt="" loading="lazy" />}<div><b>{x.q}</b>{x.a && <span>{x.a}</span>}</div><i aria-hidden>›</i></>)}</div>))}</div></section> : null;
    }

    if (b.type === 'cats') {
      return cats.length ? <section className="hb">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}<div className="hb-cats">{cats.map((x) => {
        const p = products.find((y) => y.category === x);
        return <Link key={x} href={`/?c=${encodeURIComponent(x)}#cat`} className="card hb-cat">{p && <AppLogo image={p.image} template={p.template} name={p.name} />}<span>{x}</span></Link>;
      })}</div></section> : null;
    }
    if (b.type === 'gallery') {
      const pics = (b.items ?? []).filter((x) => x.image);
      return pics.length ? <div className={`hb hb-gallery c${b.cols ?? 3}`} style={{ ['--cols' as string]: Math.min(4, Math.max(1, b.cols ?? 3)) } as React.CSSProperties}>{pics.map((x, i) => <div key={i}>{go(x.link, 'hb-image', <img src={x.image} alt="" loading="lazy" />)}</div>)}</div> : null;
    }
    if (b.type === 'imgtext') return (
      <section className={`card hb hb-imgtext${b.flip ? ' flip' : ''}`}>
        {b.image && <img src={b.image} alt="" loading="lazy" />}
        <div>{b.title && <h2>{b.title}</h2>}{b.text && <p>{b.text}</p>}{b.label && b.link && go(b.link, 'btn primary', b.label)}</div>
      </section>);
    if (b.type === 'contact') {
      const links: { href: string; label: string; color?: string }[] = contacts.map((c) => ({ href: contactHref(c), label: c.label || CONTACT_KINDS[c.kind].label, color: CONTACT_KINDS[c.kind].color }));
      if (b.label && b.link) links.push({ href: b.link, label: b.label });
      return links.length ? <section className="card hb hb-contact">{b.title && <h2>{b.title}</h2>}{b.text && <p>{b.text}</p>}<div>{links.map((l, i) => <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" className="btn lg" style={l.color ? { background: l.color, borderColor: l.color, color: '#fff' } : undefined}>{l.label}</a>)}</div></section> : null;
    }
    if (b.type === 'faq') {
      const qa = (b.items ?? []).filter((x) => x.q);
      return qa.length ? <section className="hb hb-faq">{b.title && <div className="sec-head"><h2>{b.title}</h2></div>}{qa.map((x, i) => <details key={i} className="card"><summary>{x.q}</summary>{x.a && <p>{x.a}</p>}</details>)}</section> : null;
    }
    if (b.type === 'coupon') return b.code ? <CouponBox title={b.title} code={b.code} text={b.text} /> : null;
    if (b.type === 'countdown') return b.until ? <Countdown title={b.title} until={b.until} tone={b.tone} label={b.label} link={b.link} /> : null;
    return null;
  }
  /** กล่อง + สไตล์ที่ร้านปรับเอง (สี · ความมน · ขอบ · เงา) */
  function styled(b: Block): React.ReactNode {
    const out = render(b);
    const st = out ? blockStyle(b.style) : null;
    return st ? <div className={st.className} style={st.style as React.CSSProperties}>{out}</div> : out;
  }
  // กล่องครึ่งแถวที่อยู่ติดกัน = จับคู่วางข้างกัน (จอคอม)
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i], n = blocks[i + 1];
    const half = (x?: Block) => !!x && !!x.half && HALF_OK.includes(x.type);
    if (half(b)) {
      const pair = half(n) ? [b, n!] : [b];
      if (pair.length === 2) i++;
      rows.push(<div key={b.id} className={`hb-pair${pair.length === 1 ? ' solo' : ''}`}>{pair.map((x) => <div key={x.id} className="hb-cell">{styled(x)}</div>)}</div>);
    } else rows.push(<div key={b.id} className="hb-row">{styled(b)}</div>);
  }

  return <>{rows}</>;
}
