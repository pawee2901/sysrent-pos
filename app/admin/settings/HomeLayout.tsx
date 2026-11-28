'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadImage } from '@/components/upload';
import { api, baht } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import { AppLogo } from '@/components/AppLogo';
import { splitLeft, untilMs } from '@/components/HomeBits';
import { LAYOUT_TEMPLATES, type LayoutTemplate } from '@/lib/layout-templates';
import { blockStyle, hasStyle, type BlockStyle, BLOCK_INFO, BUILTIN, DEFAULT_LAYOUT, HALF_OK, ITEMS_MAX, ITEM_SPEC, LAYOUT_MAX, PAGES_MAX, PAGE_SLUG, PALETTE, SOCIAL, newBlock, newBlockId, youtubeId, type Block, type BlockItem, type BlockType, type SocialKind } from '@/lib/home-layout';

type P = { id: string; name: string; category: string; image: string; template: string; from: number | null; sold: number };
export type LayoutInit = {
  ready: boolean; blocks: Block[]; products: P[]; categories: string[];
  shop: { name: string; tagline: string; banner: string; line: boolean; facebook: boolean }; promos: string[];
  /** คนเพิ่งซื้อจริงของร้าน (ตัวอย่างการ์ดกิจกรรม) · ว่าง = ใช้ตัวอย่างสมมุติ */
  recent?: { initial: string; dots: string; name: string; avatar: string; when: string }[];
  /** หน้าเพิ่มเติม (ready = รัน 0035 แล้ว) */
  pages: { ready: boolean; list: PageRow[] };
};
export type PageRow = { id: string; slug: string; title: string; in_menu: boolean; blocks: Block[] };
type Drag = { kind: 'new'; type: BlockType } | { kind: 'move'; id: string };

/** สีแนะนำในสไตล์กล่อง */
const SWATCHES = ['#ffffff', '#f8fafc', '#111827', '#0f172a', '#14532d', '#1e3a8a', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#f59e0b', '#16a34a', '#0ea5e9', '#fdf2f8', '#ecfdf5', '#fef3c7'];
/** กล่องที่มีช่อง "หัวข้อ" */
const TITLED: BlockType[] = ['realreviews', 'featured', 'cats', 'text', 'video', 'imgtext', 'contact', 'faq', 'coupon', 'countdown', 'heading', 'cta', 'features', 'steps', 'reviews', 'pricelist', 'numbers', 'logos', 'social', 'spotlight', 'quote', 'linkcards'];
const TONES: [NonNullable<Block['tone']>, string][] = [['accent', 'สีร้าน'], ['dark', 'ดำ'], ['ok', 'เขียว'], ['warn', 'ส้ม'], ['info', 'ฟ้า']];

/** ปุ่มเลือกแบบแถว (segmented) */
function Seg<T extends string | number | boolean>({ value, opts, set }: { value: T; opts: [T, string][]; set: (v: T) => void }) {
  return <div className="lb-seg">{opts.map(([k, l]) => <button key={String(k)} type="button" className={value === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}</div>;
}

/** สินค้าที่กล่อง "สินค้าแนะนำ" จะโชว์ (เหมือนหน้าร้าน) */
function pickProducts(b: Block, all: P[]): P[] {
  const lim = Math.min(24, Math.max(1, b.limit ?? 4));
  if (b.pick === 'ids') return (b.ids ?? []).map((id) => all.find((p) => p.id === id)).filter((p): p is P => !!p).slice(0, lim);
  return (b.pick === 'cat' ? all.filter((p) => p.category === b.category) : [...all].sort((a, z) => z.sold - a.sold)).slice(0, lim);
}

function Cards({ list }: { list: P[] }) {
  if (!list.length) return <div className="cv-empty">ยังไม่มีสินค้าที่ตรงเงื่อนไข</div>;
  return <div className="cv-grid">{list.map((p) => <div key={p.id} className="cv-pcard"><AppLogo image={p.image} template={p.template} name={p.name} /><b>{p.name}</b>{p.from !== null && <span>{baht(p.from)}</span>}</div>)}</div>;
}
const Ph = ({ children }: { children: React.ReactNode }) => <div className="cv-empty">{children}</div>;

/** หน้าตากล่องบนผืนผ้าใบ (ใกล้เคียงหน้าร้านจริง) */
function Preview({ b, d }: { b: Block; d: LayoutInit }) {
  const head = (t?: string) => t ? <div className="cv-h">{t}</div> : null;
  switch (b.type) {
    case 'hero': return d.shop.banner ? <img src={d.shop.banner} alt="" className="cv-img round" />
      : <div className="cv-hero"><small>✨ ส่งอัตโนมัติ 24 ชั่วโมง</small><b>{d.shop.tagline || d.shop.name}</b><span className="cv-btn light">เลือกซื้อเลย</span></div>;
    case 'promos': return d.promos.length ? <div className="cv-cols" style={{ ['--c' as string]: Math.min(4, d.promos.length) } as React.CSSProperties}>{d.promos.map((s, i) => <img key={i} src={s} alt="" className="cv-img" />)}</div>
      : <Ph>🎁 ยังไม่มีรูปโปร · ตั้งที่แท็บ &quot;รูปหน้าแรก · ป๊อปอัป&quot;</Ph>;
    case 'live': {
      const names = (d.products.length ? d.products : [{ name: 'สินค้า' }]).map((p) => p.name);
      const who = ['p', 'k', 'n', 'm', 's'];
      if (b.variant === 'feed') return (
        <div className="cv-feed"><div className="cv-feed-head"><div>{(b.label ?? 'STORE FEED') && <small>{b.label ?? 'STORE FEED'}</small>}<b>{b.title || 'กิจกรรมล่าสุด'}</b>{b.text && <p>{b.text}</p>}</div>{(b.badge ?? 'อัปเดตสด') && <span><i />{b.badge ?? 'อัปเดตสด'}</span>}</div>
          {(d.recent?.length ? d.recent : Array.from({ length: 20 }, (_, i) => ({ initial: who[i % who.length].toUpperCase(), dots: `${who[i % who.length]}•••••`, name: names[i % names.length], avatar: '', when: `${3 + i * 7} นาทีที่แล้ว` })))
            .slice(0, Math.min(20, b.limit ?? 5)).map((r, i) => {
              // ร้านยังไม่มีคนซื้อ: แถว 4–5 เป็นตัวอย่างลูกค้าที่ตั้งรูปโปรไฟล์
              const demo = !d.recent?.length && i >= 3 ? ['🐼', '🐰'][i - 3] : '';
              return <div key={i} className="cv-feed-row"><span style={r.avatar || demo ? { padding: 0, overflow: 'hidden', fontSize: 15, background: demo ? 'linear-gradient(135deg, #fde2e4, #e0f2fe)' : undefined } : undefined}>
                {r.avatar ? <img src={r.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : demo || r.initial}</span>
                <p><b>{r.dots}</b> {(b.events ?? 'all') === 'join' || ((b.events ?? 'all') === 'all' && i === 1) ? 'สมัครสมาชิก 🎉' : `ซื้อ ${r.name}`}</p><small>{r.when}</small></div>;
            })}</div>);
      if (b.variant === 'ticker') return <div className="cv-marquee dark"><span>🟢 @s***a ซื้อ {names[0]} · 5 นาทีที่แล้ว     🟢 @k***n ซื้อ {names[1 % names.length]} · 9 นาทีที่แล้ว</span></div>;
      return <div className="cv-live"><i />@s***a ซื้อ {names[0]} · 5 นาทีที่แล้ว</div>;
    }
    case 'stats': return <div className="cv-cols" style={{ ['--c' as string]: 3 } as React.CSSProperties}>{['สมาชิก', 'ขายไปแล้ว', 'พร้อมส่ง'].map((x) => <div key={x} className="cv-stat"><b>123</b><small>{x}</small></div>)}</div>;
    case 'products': return <>{head('สินค้าทั้งหมด')}{d.categories.length > 1 && <div className="cv-chips"><span className="on">ทั้งหมด</span>{d.categories.slice(0, 5).map((c) => <span key={c}>{c}</span>)}</div>}<Cards list={d.products.slice(0, 8)} /></>;
    case 'how': return <>{head('ซื้อง่าย 3 ขั้นตอน')}<div className="cv-cols" style={{ ['--c' as string]: 3 } as React.CSSProperties}>{['เลือกแอป', 'สแกนจ่าย', 'ได้รหัสทันที'].map((x, i) => <div key={x} className="cv-stat"><b>{i + 1}</b><small>{x}</small></div>)}</div></>;
    case 'featured': {
      const list = pickProducts(b, d.products);
      return <>{head(b.title)}{b.variant === 'list' && list.length ? <div className="cv-plist">{list.map((p) => <div key={p.id}><AppLogo image={p.image} template={p.template} name={p.name} /><span>{p.name}</span><b>{p.from !== null ? baht(p.from) : ''}</b></div>)}</div>
        : b.variant === 'scroll' && list.length ? <div className="cv-hscroll">{list.map((p) => <div key={p.id} className="cv-pcard"><AppLogo image={p.image} template={p.template} name={p.name} /><b>{p.name}</b>{p.from !== null && <span>{baht(p.from)}</span>}</div>)}</div>
        : <Cards list={list} />}</>;
    }
    case 'cats': return <>{head(b.title)}{d.categories.length ? <div className="cv-cats">{d.categories.map((c) => { const p = d.products.find((x) => x.category === c); return <div key={c}>{p && <AppLogo image={p.image} template={p.template} name={p.name} />}<span>{c}</span></div>; })}</div> : <Ph>ยังไม่มีหมวดสินค้า</Ph>}</>;
    case 'text': return b.title || b.text ? <div className={`cv-card${b.align === 'center' ? ' center' : ''}`}>{b.title && <b>{b.title}</b>}{b.text && <p>{b.text}</p>}</div> : <Ph>📝 พิมพ์ข้อความทางขวา</Ph>;
    case 'image': return b.image ? <img src={b.image} alt="" className="cv-img round" /> : <Ph>🖼️ อัปโหลดรูปทางขวา</Ph>;
    case 'gallery': {
      const pics = (b.items ?? []).filter((x) => x.image);
      return pics.length ? <div className="cv-cols" style={{ ['--c' as string]: b.cols ?? 3 } as React.CSSProperties}>{pics.map((x, i) => <img key={i} src={x.image} alt="" className="cv-img" />)}</div> : <Ph>🧩 เพิ่มรูปทางขวา</Ph>;
    }
    case 'imgtext': return <div className={`cv-card cv-it${b.flip ? ' flip' : ''}`}>{b.image ? <img src={b.image} alt="" /> : <div className="cv-it-ph">🖼️</div>}<div>{b.title && <b>{b.title}</b>}{b.text && <p>{b.text}</p>}{b.label && <span className="cv-btn">{b.label}</span>}</div></div>;
    case 'notice': return <div className={`cv-notice ${b.tone ?? 'accent'}`}>{b.text || 'ข้อความประกาศ'}</div>;
    case 'button': return <div className="cv-center"><span className="cv-btn big">{b.label || 'ปุ่ม'}</span></div>;
    case 'contact': return <div className="cv-card center">{b.title && <b>{b.title}</b>}{b.text && <p>{b.text}</p>}<div className="cv-row">{d.shop.line && <span className="cv-btn line">LINE</span>}{d.shop.facebook && <span className="cv-btn fb">Facebook</span>}{b.label && b.link && <span className="cv-btn">{b.label}</span>}{!d.shop.line && !d.shop.facebook && !(b.label && b.link) && <small className="muted">ร้านยังไม่ได้ใส่ลิงก์ LINE / Facebook</small>}</div></div>;
    case 'faq': return <>{head(b.title)}{(b.items ?? []).filter((x) => x.q).map((x, i) => <div key={i} className="cv-faq"><b>{x.q}</b>{i === 0 && x.a && <p>{x.a}</p>}</div>)}{!(b.items ?? []).some((x) => x.q) && <Ph>❓ เพิ่มคำถามทางขวา</Ph>}</>;
    case 'coupon': return <div className="cv-coupon"><div>{b.title && <b>{b.title}</b>}{b.text && <small>{b.text}</small>}</div><span>{b.code || 'CODE'}</span></div>;
    case 'countdown': {
      const ms = untilMs(b.until) - Date.now(), t = splitLeft(ms);
      return <div className={`cv-count ${b.tone ?? 'dark'}`}>{b.title && <b>{ms > 0 ? b.title : 'โปรนี้หมดเวลาแล้ว'}</b>}{ms > 0 && <div>{['วัน', 'ชม.', 'นาที', 'วิ'].map((u, i) => <span key={u}><b>{String(t[i]).padStart(2, '0')}</b><small>{u}</small></span>)}</div>}{b.label && <span className="cv-btn light">{b.label}</span>}</div>;
    }
    case 'video': { const id = youtubeId(b.video); return <>{head(b.title)}<div className="cv-video" style={id ? { backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` } : undefined}><span>▶</span>{!id && <small>ใส่ลิงก์ YouTube ทางขวา</small>}</div></>; }
    case 'divider': return <hr className="cv-hr" />;
    case 'realreviews': return <>{head(b.title)}<div className="cv-reviews">{[['ส่งไวมาก ได้รหัสทันที', 5], ['ใช้งานได้จริง คุ้มราคา', 5], ['แอดมินตอบไว', 4]].map(([t, n], i) => <div key={i}><span className="cv-stars">{'★'.repeat(n as number)}<i>{'★'.repeat(5 - (n as number))}</i></span><p>{t}</p><small>— ลูกค้าจริง</small></div>)}</div><small className="muted">ตัวอย่าง · หน้าร้านแสดงรีวิวจริงของลูกค้า (ยังไม่มีรีวิว = ไม่แสดงกล่องนี้)</small></>;
    case 'heading': return <div className={`cv-heading ${b.size ?? 'm'}${b.align === 'left' ? '' : ' center'}`}>{b.title && <b>{b.title}</b>}{b.text && <p>{b.text}</p>}</div>;
    case 'slider': { const pics = (b.items ?? []).filter((x) => x.image); return pics.length ? <div className="cv-slider"><img src={pics[0].image} alt="" className="cv-img round" /><div>{pics.map((_, i) => <i key={i} className={i ? '' : 'on'} />)}</div></div> : <Ph>🎞️ เพิ่มรูปสไลด์ทางขวา</Ph>; }
    case 'cta': return <div className={`cv-cta ${b.tone ?? 'accent'}`} style={b.image ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.7), rgba(0,0,0,.2)), url("${b.image}")` } : undefined}><div>{b.title && <b>{b.title}</b>}{b.text && <p>{b.text}</p>}</div>{b.label && <span className="cv-btn light">{b.label}</span>}</div>;
    case 'features': case 'numbers': case 'badges': {
      const list = (b.items ?? []).filter((x) => x.q);
      if (!list.length) return <Ph>{BLOCK_INFO[b.type].icon} เพิ่มรายการทางขวา</Ph>;
      return <>{head(b.title)}<div className={`cv-${b.type}`} style={{ ['--c' as string]: b.cols ?? Math.min(4, list.length) } as React.CSSProperties}>{list.map((x, i) => <div key={i}>{x.icon && <span>{x.icon}</span>}<b>{x.q}</b>{x.a && <small>{x.a}</small>}</div>)}</div></>;
    }
    case 'steps': { const list = (b.items ?? []).filter((x) => x.q); return <>{head(b.title)}{list.length ? <div className="cv-steps">{list.map((x, i) => <div key={i}><span>{i + 1}</span><div><b>{x.q}</b>{x.a && <small>{x.a}</small>}</div></div>)}</div> : <Ph>🪜 เพิ่มขั้นตอนทางขวา</Ph>}</>; }
    case 'reviews': { const list = (b.items ?? []).filter((x) => x.q || x.a); return <>{head(b.title)}{list.length ? <div className="cv-reviews">{list.map((x, i) => <div key={i}><span className="cv-stars">{'★'.repeat(x.stars ?? 5)}<i>{'★'.repeat(5 - (x.stars ?? 5))}</i></span><p>{x.a}</p><small>— {x.q}</small></div>)}</div> : <Ph>💬 เพิ่มรีวิวทางขวา</Ph>}</>; }
    case 'pricelist': { const list = (b.items ?? []).filter((x) => x.q); return <>{head(b.title)}{list.length ? <div className="cv-prices">{list.map((x, i) => <div key={i}><span>{x.q}</span><i /><b>{x.a}</b></div>)}</div> : <Ph>🏷️ เพิ่มรายการทางขวา</Ph>}{b.text && <small className="muted">{b.text}</small>}</>; }
    case 'marquee': return <div className={`cv-marquee ${b.tone ?? 'dark'}`}><span>{b.text || 'ข้อความวิ่ง'}</span></div>;
    case 'logos': { const pics = (b.items ?? []).filter((x) => x.image); return <>{head(b.title)}{pics.length ? <div className="cv-logos">{pics.map((x, i) => <img key={i} src={x.image} alt="" />)}</div> : <Ph>🏅 เพิ่มโลโก้ทางขวา</Ph>}</>; }
    case 'social': { const list = (b.items ?? []).filter((x) => x.kind); return <div className="cv-card center">{b.title && <b>{b.title}</b>}<div className="cv-row">{list.map((x, i) => { const so = SOCIAL[x.kind!]; return <span key={i} className="cv-btn" style={{ background: so.color, opacity: x.link ? 1 : .45 }}>{so.label}</span>; })}</div>{list.some((x) => !x.link) && <small className="muted">ปุ่มที่จาง = ยังไม่ใส่ลิงก์ (หน้าร้านจะไม่แสดง)</small>}</div>; }
    case 'spotlight': {
      const p = d.products.find((x) => x.id === b.ids?.[0]) ?? [...d.products].sort((a, z) => z.sold - a.sold)[0];
      return p ? <div className="cv-card cv-spot"><div><AppLogo image={p.image} template={p.template} name={p.name} size="lg" /></div><div>{b.title && <small className="cv-pill">{b.title}</small>}<b>{p.name}</b>{b.text && <p>{b.text}</p>}<span className="cv-row" style={{ justifyContent: 'flex-start' }}>{p.from !== null && <strong>{baht(p.from)}</strong>}<span className="cv-btn">{b.label || 'ซื้อเลย'}</span></span></div></div> : <Ph>ยังไม่มีสินค้า</Ph>;
    }
    case 'quote': return <div className={`cv-quote${b.align === 'left' ? '' : ' center'}`}><b>{b.text || 'ข้อความ'}</b>{b.title && <small>— {b.title}</small>}</div>;
    case 'linkcards': { const list = (b.items ?? []).filter((x) => x.q); return <>{head(b.title)}{list.length ? <div className="cv-links" style={{ ['--c' as string]: b.cols ?? 3 } as React.CSSProperties}>{list.map((x, i) => <div key={i}>{x.image && <img src={x.image} alt="" />}<div><b>{x.q}</b>{x.a && <small>{x.a}</small>}</div><i>›</i></div>)}</div> : <Ph>🗃️ เพิ่มการ์ดทางขวา</Ph>}</>; }
    case 'space': return <div className={`cv-space ${b.size ?? 'm'}`}>ช่องว่าง</div>;
  }
}

/** จัดหน้าแรกแบบลากวาง: แถบกล่อง (ซ้าย) · หน้าร้านจำลอง (กลาง) · ตั้งค่ากล่องที่เลือก (ขวา) */
export function HomeLayout({ init }: { init: LayoutInit }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(init.blocks);
  /** หน้าที่กำลังจัด: 'home' = หน้าแรก · อื่น ๆ = id ของหน้าเพิ่มเติม */
  const [page, setPage] = useState('home');
  const [pages, setPages] = useState<PageRow[]>(init.pages.list);
  const [homeSaved, setHomeSaved] = useState<Block[]>(init.blocks);
  const [newPage, setNewPage] = useState<{ title: string; slug: string; tpl: string } | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  /** ไอคอนกล่องของแต่ละแม่แบบ (ไว้วาดผังย่อในการ์ด) */
  const tplShapes = useMemo(() => Object.fromEntries(LAYOUT_TEMPLATES.map((t) => [t.key, t.build()])), []);
  const [meta, setMeta] = useState<{ title: string; slug: string; in_menu: boolean } | null>(null);
  const curPage = pages.find((x) => x.id === page) ?? null;
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<'pc' | 'phone'>('pc');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const [drop, setDrop] = useState<number | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const blocksRef = useRef(blocks); blocksRef.current = blocks;
  const dropRef = useRef<number | null>(null);
  const press = useRef<{ d: Drag; x0: number; y0: number; label: string; started: boolean; canDrag: boolean; click: () => void } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const onFiles = useRef<(urls: string[]) => void>(() => {});
  const [multi, setMulti] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (next: Block[]) => { setBlocks(next); setDirty(true); };
  const patch = (id: string, p: Partial<Block>) => update(blocksRef.current.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const has = (t: BlockType) => blocks.some((b) => b.type === t);
  const selIdx = blocks.findIndex((b) => b.id === sel);
  const cur = selIdx >= 0 ? blocks[selIdx] : null;

  function insert(type: BlockType, at: number) {
    if (BUILTIN.includes(type) && blocksRef.current.some((b) => b.type === type)) { notify(`มี "${BLOCK_INFO[type].label}" อยู่แล้ว`, 'info'); return; }
    if (blocksRef.current.length >= LAYOUT_MAX) { notify(`ใส่ได้สูงสุด ${LAYOUT_MAX} กล่อง`, 'error'); return; }
    const b = newBlock(type), a = [...blocksRef.current];
    a.splice(Math.max(0, Math.min(at, a.length)), 0, b);
    update(a); setSel(b.id);
    setTimeout(() => document.getElementById(`cv-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  }
  function moveTo(id: string, at: number) {
    const a = [...blocksRef.current], from = a.findIndex((b) => b.id === id);
    if (from < 0) return;
    const [x] = a.splice(from, 1);
    a.splice(at > from ? at - 1 : at, 0, x);
    update(a);
  }
  const step = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= blocks.length) return; const a = [...blocks]; [a[i], a[j]] = [a[j], a[i]]; update(a); };
  function duplicate(i: number) {
    const b = blocks[i];
    if (BUILTIN.includes(b.type)) { notify('กล่องของระบบมีได้กล่องเดียว', 'info'); return; }
    const c = { ...structuredClone(b), id: newBlockId() }, a = [...blocks];
    a.splice(i + 1, 0, c); update(a); setSel(c.id);
  }
  const remove = (i: number) => { update(blocks.filter((_, k) => k !== i)); setSel(null); };

  // ---------- ลากวาง (เมาส์ + นิ้ว) ----------
  function dropAt(x: number, y: number): number | null {
    const el = canvas.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (x < r.left - 30 || x > r.right + 30 || y < r.top - 60 || y > r.bottom + 60) return null;
    const kids = [...el.querySelectorAll<HTMLElement>('[data-idx]')];
    for (const k of kids) {
      const b = k.getBoundingClientRect(), i = Number(k.dataset.idx);
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
        const before = k.dataset.half === '1' ? x < b.left + b.width / 2 : y < b.top + b.height / 2;
        return before ? i : i + 1;
      }
    }
    for (const k of kids) { const b = k.getBoundingClientRect(); if (y < b.top + b.height / 2) return Number(k.dataset.idx); }
    return blocksRef.current.length;
  }
  function onMove(e: PointerEvent) {
    const p = press.current;
    if (!p) return;
    if (!p.started) {
      if (!p.canDrag || Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) return;
      p.started = true;
      document.body.classList.add('lb-dragging');
    }
    e.preventDefault();
    setGhost({ x: e.clientX, y: e.clientY, label: p.label });
    const at = dropAt(e.clientX, e.clientY);
    dropRef.current = at; setDrop(at);
    if (e.clientY < 70) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
  }
  function onUp() {
    const p = press.current;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    press.current = null;
    document.body.classList.remove('lb-dragging');
    if (p?.started) {
      const at = dropRef.current;
      if (at !== null) { if (p.d.kind === 'new') insert(p.d.type, at); else moveTo(p.d.id, at); }
    } else p?.click();
    dropRef.current = null; setDrop(null); setGhost(null);
  }
  function startPress(e: React.PointerEvent, d: Drag, label: string, click: () => void, canDrag = true) {
    if (e.button !== 0 || press.current) return;
    if (canDrag && e.pointerType === 'mouse') e.preventDefault();
    press.current = { d, x0: e.clientX, y0: e.clientY, label, started: false, canDrag, click };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // ---------- อัปรูป ----------
  function pickFiles(many: boolean, done: (urls: string[]) => void) { onFiles.current = done; setMulti(many); setTimeout(() => file.current?.click(), 0); }
  async function upload(list: File[]) {
    if (!list.length) return;
    setBusy(true);
    const urls: string[] = [];
    for (const fl of list) {
      const r = await uploadImage(fl);
      if (r.ok) urls.push(r.data.url); else { notify(r.error, 'error'); break; }
    }
    setBusy(false);
    if (urls.length) onFiles.current(urls);
  }

  async function save(list = blocks, done = curPage ? `บันทึกหน้า "${curPage.title}" แล้ว ✓` : 'บันทึกหน้าแรกแล้ว ✓'): Promise<boolean> {
    setBusy(true);
    const r = await api('/api/admin/settings', curPage ? { action: 'layout', page_id: curPage.id, blocks: list } : { action: 'layout', blocks: list });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return false; }
    if (curPage) setPages((ps) => ps.map((x) => (x.id === curPage.id ? { ...x, blocks: list } : x))); else setHomeSaved(list.length ? list : DEFAULT_LAYOUT);
    setDirty(false); notify(done); router.refresh();
    return true;
  }
  /** สลับหน้าที่จัด (ยังไม่บันทึก = บันทึกให้ก่อน) */
  async function openPage(id: string) {
    if (id === page) return;
    if (dirty && !(await save())) return;
    const target = pages.find((x) => x.id === id);
    setPage(id); setSel(null); setDirty(false); setNewPage(null);
    setBlocks(target ? target.blocks : homeSaved);
    setMeta(target ? { title: target.title, slug: target.slug, in_menu: target.in_menu } : null);
  }
  async function createPage() {
    if (!newPage) return;
    const title = newPage.title.trim(), slug = newPage.slug.trim().toLowerCase();
    if (!title) { notify('ใส่ชื่อหน้าก่อน', 'error'); return; }
    if (!PAGE_SLUG.test(slug)) { notify('ลิงก์หน้าใช้ a-z 0-9 และ - เท่านั้น', 'error'); return; }
    if (dirty && !(await save())) return;
    setBusy(true);
    const r = await api<{ page: { id: string; slug: string; title: string; in_menu: boolean } }>('/api/admin/settings', { action: 'page_create', title, slug });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    // หน้าใหม่: เริ่มจากแม่แบบที่เลือก (ไม่เลือก = หัวข้อ 1 กล่อง)
    const tpl = LAYOUT_TEMPLATES.find((t) => t.key === newPage.tpl);
    const first: Block[] = tpl ? tpl.build().map((b, i) => (i === 0 && b.type === 'heading' ? { ...b, title } : b)) : [{ ...newBlock('heading'), title, text: '' }];
    const row: PageRow = { ...r.data.page, blocks: first };
    setPages((ps) => [...ps, row]);
    setPage(row.id); setBlocks(first); setDirty(true); setSel(null); setNewPage(null);
    setMeta({ title: row.title, slug: row.slug, in_menu: row.in_menu });
    notify('สร้างหน้าแล้ว ลากกล่องมาวางแล้วกดบันทึก ✓');
  }
  async function saveMeta() {
    if (!curPage || !meta) return;
    setBusy(true);
    const r = await api('/api/admin/settings', { action: 'page_update', id: curPage.id, ...meta, slug: meta.slug.trim().toLowerCase() });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    setPages((ps) => ps.map((x) => (x.id === curPage.id ? { ...x, ...meta, slug: meta.slug.trim().toLowerCase() } : x)));
    notify('บันทึกข้อมูลหน้าแล้ว ✓'); router.refresh();
  }
  async function deletePage() {
    if (!curPage || !(await ask(`ลบหน้า "${curPage.title}"?`, { text: 'กล่องทั้งหมดในหน้านี้จะหายไป และลิงก์หน้านี้จะใช้ไม่ได้', ok: 'ลบหน้า', danger: true }))) return;
    setBusy(true);
    const r = await api('/api/admin/settings', { action: 'page_delete', id: curPage.id });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    setPages((ps) => ps.filter((x) => x.id !== curPage.id));
    setPage('home'); setBlocks(homeSaved); setDirty(false); setSel(null); setMeta(null);
    notify('ลบหน้าแล้ว'); router.refresh();
  }
  async function applyTemplate(t: LayoutTemplate) {
    const has = blocksRef.current.length > 0;
    if (has && !(await ask(`ใช้แม่แบบ "${t.name}"?`, { text: 'กล่องที่จัดไว้ในหน้านี้จะถูกแทนที่ (ถ้ายังไม่พอใจ ปิดหน้านี้โดยไม่กดบันทึกได้)', ok: 'ใช้แม่แบบนี้' }))) return;
    update(t.build()); setSel(null); setTplOpen(false);
    notify(`ใช้แม่แบบ "${t.name}" แล้ว · แก้ต่อแล้วกดบันทึก`);
  }
  const slugFrom = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `page-${pages.length + 1}`;
  async function reset() {
    if (curPage) {
      if (!(await ask(`ล้างกล่องทั้งหมดในหน้า "${curPage.title}"?`, { ok: 'ล้างหน้า', danger: true }))) return;
      setBlocks([]); setSel(null); save([], 'ล้างหน้าแล้ว ✓');
      return;
    }
    if (!(await ask('กลับไปใช้หน้าแรกแบบเดิม?', { text: 'กล่องที่เพิ่มเองจะหายทั้งหมด', ok: 'กลับเป็นแบบเดิม', danger: true }))) return;
    setBlocks(DEFAULT_LAYOUT); setSel(null); save([], 'กลับเป็นหน้าแรกแบบเดิมแล้ว ✓');
  }

  const setItem = (b: Block, i: number, p: Partial<BlockItem>) => patch(b.id, { items: (b.items ?? []).map((x, k) => (k === i ? { ...x, ...p } : x)) });
  /** ส่วน "สไตล์กล่อง": สี · ความมน · ระยะขอบ · เส้นขอบ · เงา */
  function styleEditor(b: Block) {
    const s = b.style ?? {};
    const setS = (p: Partial<BlockStyle>) => {
      const next = { ...s, ...p };
      (Object.keys(next) as (keyof BlockStyle)[]).forEach((k) => { if (next[k] === undefined || next[k] === '') delete next[k]; });
      patch(b.id, { style: Object.keys(next).length ? next : undefined });
    };
    const colorRow = (k: 'bg' | 'fg' | 'accent' | 'card', label: string) => (
      <div className="lb-color"><span>{label}</span>
        <div className="lb-swatches">{SWATCHES.map((c) => <button key={c} type="button" className={s[k] === c ? 'on' : ''} style={{ background: c }} aria-label={`${label} ${c}`} onClick={() => setS({ [k]: c })} />)}
          <label className="lb-pick" title="เลือกสีเอง"><input type="color" value={s[k] ?? '#888888'} onChange={(e) => setS({ [k]: e.target.value })} />🎨</label>
          {s[k] && <button type="button" className="lb-clear" onClick={() => setS({ [k]: undefined })}>ตามธีม</button>}</div>
      </div>);
    return (
      <details className="lb-style" open={hasStyle(b.style)}>
        <summary>🎨 สไตล์กล่อง{hasStyle(b.style) && <small> · ปรับแล้ว</small>}</summary>
        <div className="lb-style-body">
          {colorRow('bg', 'สีพื้นกล่อง')}
          {colorRow('fg', 'สีตัวอักษร')}
          {colorRow('accent', 'สีหลัก (ปุ่ม · ราคา · ไฮไลต์)')}
          {colorRow('card', 'สีการ์ดด้านใน')}
          <label className="lb-range"><span>ความมนของมุม <b>{s.radius ?? 'ตามธีม'}{s.radius !== undefined && 'px'}</b></span>
            <input type="range" min={0} max={48} step={2} value={s.radius ?? 20} onChange={(e) => setS({ radius: Number(e.target.value) })} />
            <span className="lb-range-ends"><small>เหลี่ยม</small>{s.radius !== undefined && <button type="button" className="lb-clear" onClick={() => setS({ radius: undefined })}>ตามธีม</button>}<small>มนมาก</small></span></label>
          <label className="lb-range"><span>ระยะขอบด้านใน <b>{s.pad ?? 'อัตโนมัติ'}{s.pad !== undefined && 'px'}</b></span>
            <input type="range" min={0} max={64} step={4} value={s.pad ?? (s.bg ? 24 : 0)} onChange={(e) => setS({ pad: Number(e.target.value) })} />
            {s.pad !== undefined && <button type="button" className="lb-clear" onClick={() => setS({ pad: undefined })}>อัตโนมัติ</button>}</label>
          <div className="field"><span>เส้นขอบ</span><Seg value={s.border ?? 'none'} set={(v) => setS({ border: v === 'none' ? undefined : v })} opts={[['none', 'ไม่มี'], ['line', 'เส้นบาง'], ['accent', 'สีหลัก']]} /></div>
          <div className="field"><span>เงา</span><Seg value={s.shadow ?? 'none'} set={(v) => setS({ shadow: v === 'none' ? undefined : v })} opts={[['none', 'ไม่มี'], ['soft', 'นุ่ม'], ['strong', 'เข้ม']]} /></div>
          {hasStyle(b.style) && <button type="button" className="btn ghost sm" onClick={() => patch(b.id, { style: undefined })}>ล้างสไตล์ทั้งหมด (กลับไปตามธีม)</button>}
        </div>
      </details>
    );
  }
  const itemsOf = (id: string) => blocksRef.current.find((x) => x.id === id)?.items ?? [];
  /** แก้รายการย่อย (รูปในแกลเลอรี / สไลด์ · คำถาม · จุดเด่น · รีวิว ฯลฯ) ตาม ITEM_SPEC */
  function renderItems(b: Block) {
    const spec = ITEM_SPEC[b.type]!, items = b.items ?? [], hasF = (f: string) => spec.fields.includes(f as never);
    const picOnly = spec.fields[0] === 'image';
    const moveItem = (i: number) => { const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; patch(b.id, { items: a }); };
    return (
      <div className="field"><span>{spec.noun} ({items.length}/{ITEMS_MAX})</span>
        <div className={picOnly ? 'lb-gal' : 'lb-items'}>{items.map((x, i) => (
          <div key={i} className={picOnly ? 'lb-gal-item' : 'lb-item'}>
            {picOnly ? <div><img src={x.image} alt="" /><button type="button" aria-label="ลบ" onClick={() => patch(b.id, { items: items.filter((_, k) => k !== i) })}>✕</button></div> : (
              <div className="lb-item-head"><b>{spec.noun} {i + 1}</b>
                {i > 0 && <button type="button" className="btn ghost sm" aria-label="เลื่อนขึ้น" onClick={() => moveItem(i)}>↑</button>}
                <button type="button" className="btn ghost sm" aria-label="ลบ" onClick={() => patch(b.id, { items: items.filter((_, k) => k !== i) })}>✕</button></div>)}
            {hasF('kind') && <select className="input" value={x.kind ?? 'tiktok'} onChange={(e) => setItem(b, i, { kind: e.target.value as SocialKind })}>{(Object.keys(SOCIAL) as SocialKind[]).map((k) => <option key={k} value={k}>{SOCIAL[k].label}</option>)}</select>}
            {!picOnly && hasF('image') && <div className="lb-row">{x.image && <img src={x.image} alt="" className="lb-thumb" />}
              <button type="button" className="btn sm" disabled={busy} onClick={() => pickFiles(false, ([u]) => patch(b.id, { items: itemsOf(b.id).map((y, k) => (k === i ? { ...y, image: u } : y)) }))}>{x.image ? 'เปลี่ยนรูป' : b.type === 'reviews' ? 'รูปลูกค้า (ไม่บังคับ)' : 'ใส่รูป'}</button>
              {x.image && <button type="button" className="btn ghost sm" onClick={() => setItem(b, i, { image: '' })}>เอาออก</button>}</div>}
            {(hasF('icon') || hasF('q')) && <div className="lb-row lb-iq">
              {hasF('icon') && <input className="input lb-icon" value={x.icon ?? ''} maxLength={12} placeholder="😀" aria-label="ไอคอน (อีโมจิ)" onChange={(e) => setItem(b, i, { icon: e.target.value })} />}
              {hasF('q') && <input className="input" value={x.q ?? ''} maxLength={200} placeholder={spec.q} aria-label={spec.q} onChange={(e) => setItem(b, i, { q: e.target.value })} />}</div>}
            {hasF('stars') && <Seg value={x.stars ?? 5} set={(v) => setItem(b, i, { stars: v })} opts={[[1, '1★'], [2, '2★'], [3, '3★'], [4, '4★'], [5, '5★']]} />}
            {hasF('a') && (b.type === 'pricelist' || b.type === 'numbers'
              ? <input className="input" value={x.a ?? ''} maxLength={200} placeholder={spec.a} aria-label={spec.a} onChange={(e) => setItem(b, i, { a: e.target.value })} />
              : <textarea className="input" rows={2} value={x.a ?? ''} maxLength={1000} placeholder={spec.a} aria-label={spec.a} onChange={(e) => setItem(b, i, { a: e.target.value })} />)}
            {hasF('link') && <input className="input" value={x.link ?? ''} maxLength={300} placeholder={b.type === 'social' ? 'https://...' : 'ลิงก์ (ไม่บังคับ)'} aria-label="ลิงก์" onChange={(e) => setItem(b, i, { link: e.target.value })} />}
          </div>))}</div>
        {items.length < ITEMS_MAX && (picOnly
          ? <button type="button" className="btn sm" disabled={busy || !init.ready} onClick={() => pickFiles(true, (urls) => patch(b.id, { items: [...itemsOf(b.id), ...urls.map((image) => ({ image, link: '' }))].slice(0, ITEMS_MAX) }))}>＋ เพิ่ม{spec.noun}</button>
          : <button type="button" className="btn sm" onClick={() => patch(b.id, { items: [...items, { ...spec.add }] })}>＋ เพิ่ม{spec.noun}</button>)}
      </div>
    );
  }
  const dropLine = (i: number) => (ghost && drop === i ? <div key={`drop${i}`} className="cv-drop" /> : null);

  return (
    <section className="card lb">
      <div className="lb-top">
        <div><h2>จัดหน้าร้าน</h2><small className="muted">ลากกล่องจากด้านซ้ายไปวางบนหน้าร้าน · กดกล่องเพื่อแก้ไข · ลากกล่องบนหน้าร้านเพื่อย้ายที่</small></div>
        <div className="lb-top-acts">
          <button type="button" className="btn sm lb-tpl-btn" onClick={() => setTplOpen(true)}>🎨 แม่แบบ</button>
          <Seg value={view} set={setView} opts={[['pc', '🖥 คอม'], ['phone', '📱 มือถือ']]} />
          <button type="button" className="btn ghost sm" disabled={busy || !init.ready} onClick={reset}>{curPage ? 'ล้างหน้า' : 'กลับเป็นแบบเดิม'}</button>
          <a href={curPage ? `/s/${curPage.slug}` : '/'} target="_blank" rel="noopener" className="btn ghost sm">ดูหน้านี้ ↗</a>
          <button type="button" className="btn primary sm" disabled={busy || !init.ready} onClick={() => save()}>{busy ? 'กำลังบันทึก…' : dirty ? 'บันทึก •' : 'บันทึก'}</button>
        </div>
      </div>
      {!init.ready && <p className="lb-warn">⚠️ ต้องรัน SQL <code>0034_shop_home_layout.sql</code> ใน Supabase ก่อน ถึงจะบันทึกได้</p>}
      <div className="lb-pages">
        <div className="lb-page-tabs" role="tablist" aria-label="หน้าที่จัด">
          <button type="button" role="tab" aria-selected={page === 'home'} className={page === 'home' ? 'on' : ''} onClick={() => openPage('home')}>🏠 หน้าแรก</button>
          {pages.map((x) => <button key={x.id} type="button" role="tab" aria-selected={page === x.id} className={page === x.id ? 'on' : ''} onClick={() => openPage(x.id)}>📄 {x.title}</button>)}
          {init.pages.ready && pages.length < PAGES_MAX && <button type="button" className="add" onClick={() => setNewPage(newPage ? null : { title: '', slug: '', tpl: '' })}>＋ สร้างหน้าใหม่</button>}
        </div>
        {!init.pages.ready && <small className="lb-warn" style={{ margin: 0 }}>อยากสร้างหลายหน้า: รัน SQL <code>0035_shop_pages.sql</code> ใน Supabase ก่อน</small>}
        {newPage && (
          <div className="lb-page-form">
            <label className="field"><span>ชื่อหน้า (โชว์ในเมนู)</span><input className="input" autoFocus value={newPage.title} maxLength={60} placeholder="เช่น โปรโมชัน · เกี่ยวกับเรา · วิธีสั่งซื้อ"
              onChange={(e) => setNewPage({ ...newPage, title: e.target.value, slug: newPage.slug && newPage.slug !== slugFrom(newPage.title) ? newPage.slug : slugFrom(e.target.value) })} /></label>
            <label className="field"><span>ลิงก์หน้า</span><div className="lb-slug"><small>/s/</small><input className="input" value={newPage.slug} maxLength={40} placeholder="promotion" onChange={(e) => setNewPage({ ...newPage, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></div></label>
            <label className="field"><span>เริ่มจากแม่แบบ</span><select className="input" value={newPage.tpl} onChange={(e) => {
              const t = LAYOUT_TEMPLATES.find((x) => x.key === e.target.value);
              setNewPage({ ...newPage, tpl: e.target.value, title: newPage.title || (t?.name ?? ''), slug: newPage.slug || (t ? t.key : '') });
            }}><option value="">หน้าว่าง</option>{LAYOUT_TEMPLATES.filter((t) => t.kind === 'page').map((t) => <option key={t.key} value={t.key}>{t.icon} {t.name}</option>)}</select></label>
            <div className="lb-row"><button type="button" className="btn primary sm" disabled={busy} onClick={createPage}>สร้างหน้า</button><button type="button" className="btn ghost sm" onClick={() => setNewPage(null)}>ยกเลิก</button></div>
          </div>
        )}
        {curPage && meta && !newPage && (
          <div className="lb-page-form">
            <label className="field"><span>ชื่อหน้า</span><input className="input" value={meta.title} maxLength={60} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></label>
            <label className="field"><span>ลิงก์หน้า</span><div className="lb-slug"><small>/s/</small><input className="input" value={meta.slug} maxLength={40} onChange={(e) => setMeta({ ...meta, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></div></label>
            <label className="lb-check"><input type="checkbox" checked={meta.in_menu} onChange={(e) => setMeta({ ...meta, in_menu: e.target.checked })} />โชว์ในเมนูร้าน</label>
            <div className="lb-row">
              <button type="button" className="btn sm" disabled={busy || (meta.title === curPage.title && meta.slug === curPage.slug && meta.in_menu === curPage.in_menu)} onClick={saveMeta}>บันทึกข้อมูลหน้า</button>
              <button type="button" className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/s/${curPage.slug}`).then(() => notify('คัดลอกลิงก์แล้ว'), () => {}); }}>คัดลอกลิงก์</button>
              <button type="button" className="btn ghost sm danger" disabled={busy} onClick={deletePage}>ลบหน้านี้</button>
            </div>
          </div>
        )}
      </div>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple={multi} hidden onChange={(e) => { const fl = [...(e.target.files ?? [])]; e.target.value = ''; upload(fl); }} />

      <div className="lb-body">
        {/* แถบกล่อง */}
        <aside className="lb-pal" aria-label="กล่องที่ลากมาวางได้">
          {PALETTE.map(([group, types]) => (
            <div key={group} className="lb-pal-g">
              <small>{group}</small>
              <div className="lb-pal-list">{types.map((t) => {
                const taken = BUILTIN.includes(t) && has(t);
                return (
                  <button key={t} type="button" className="lb-tile" disabled={taken} title={taken ? 'มีอยู่บนหน้าแล้ว' : `${BLOCK_INFO[t].desc} · ลากไปวาง หรือกดเพื่อเพิ่ม`}
                    onPointerDown={(e) => startPress(e, { kind: 'new', type: t }, `${BLOCK_INFO[t].icon} ${BLOCK_INFO[t].label}`, () => insert(t, selIdx >= 0 ? selIdx + 1 : blocksRef.current.length))}>
                    <span aria-hidden>{BLOCK_INFO[t].icon}</span><b>{BLOCK_INFO[t].label}</b>
                  </button>
                );
              })}</div>
            </div>
          ))}
        </aside>

        {/* หน้าร้านจำลอง */}
        <div className="lb-stage" onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
          <div className={`lb-canvas ${view}`}>
            <div className="cv-topbar"><b>{init.shop.name}</b><span /><span /></div>
            <div ref={canvas} className="cv-flow">
              {blocks.flatMap((b, i) => {
                const half = !!b.half && HALF_OK.includes(b.type) && view === 'pc';
                return [dropLine(i), (
                  <div key={b.id} id={`cv-${b.id}`} data-idx={i} data-half={half ? '1' : '0'}
                    className={`cv-block${half ? ' half' : ''}${sel === b.id ? ' sel' : ''}${b.on ? '' : ' off'}${press.current?.d.kind === 'move' && press.current.d.id === b.id && ghost ? ' moving' : ''}`}
                    onPointerDown={(e) => { if ((e.target as HTMLElement).closest('.cv-tools')) return; startPress(e, { kind: 'move', id: b.id }, `${BLOCK_INFO[b.type].icon} ${BLOCK_INFO[b.type].label}`, () => setSel(b.id), e.pointerType === 'mouse'); }}>
                    <span className="cv-tag">{BLOCK_INFO[b.type].icon} {BLOCK_INFO[b.type].label}{!b.on && ' · ซ่อนอยู่'}</span>
                    {sel === b.id && (
                      <div className="cv-tools">
                        <span className="cv-grip" title="ลากเพื่อย้าย" onPointerDown={(e) => { e.stopPropagation(); startPress(e, { kind: 'move', id: b.id }, `${BLOCK_INFO[b.type].icon} ${BLOCK_INFO[b.type].label}`, () => {}); }}>⠿</span>
                        <button type="button" disabled={i === 0} aria-label="เลื่อนขึ้น" onClick={() => step(i, -1)}>↑</button>
                        <button type="button" disabled={i === blocks.length - 1} aria-label="เลื่อนลง" onClick={() => step(i, 1)}>↓</button>
                        <button type="button" aria-label="ทำซ้ำ" title="ทำซ้ำ" onClick={() => duplicate(i)}>⧉</button>
                        <button type="button" aria-label={b.on ? 'ซ่อน' : 'แสดง'} title={b.on ? 'ซ่อน' : 'แสดง'} onClick={() => patch(b.id, { on: !b.on })}>{b.on ? '👁' : '🚫'}</button>
                        <button type="button" aria-label="ลบ" title="ลบ" onClick={() => remove(i)}>🗑</button>
                      </div>
                    )}
                    <div className="cv-body">{(() => { const st = blockStyle(b.style); return st ? <div className={st.className} style={st.style as React.CSSProperties}><Preview b={b} d={init} /></div> : <Preview b={b} d={init} />; })()}</div>
                  </div>
                )];
              })}
              {dropLine(blocks.length)}
              {!blocks.length && <div className="cv-start">ลากกล่องจากด้านซ้ายมาวางตรงนี้</div>}
            </div>
          </div>
        </div>

        {/* ตั้งค่ากล่องที่เลือก */}
        <aside className={`lb-panel${cur ? ' show' : ''}`} aria-label="ตั้งค่ากล่อง">
          {!cur ? <div className="lb-panel-empty"><span aria-hidden>👆</span><p>กดกล่องบนหน้าร้านเพื่อแก้ไข</p></div> : (() => {
            const b = cur, info = BLOCK_INFO[b.type], builtin = BUILTIN.includes(b.type);
            const txt = (k: 'title' | 'text' | 'label' | 'link' | 'code', label: string, o: { max?: number; rows?: number; ph?: string } = {}) => (
              <label className="field"><span>{label}</span>{o.rows
                ? <textarea className="input" rows={o.rows} value={b[k] ?? ''} maxLength={o.max ?? 1000} placeholder={o.ph} onChange={(e) => patch(b.id, { [k]: e.target.value })} />
                : <input className="input" value={b[k] ?? ''} maxLength={o.max ?? 80} placeholder={o.ph} onChange={(e) => patch(b.id, { [k]: k === 'code' ? e.target.value.toUpperCase().replace(/\s/g, '') : e.target.value })} />}</label>);
            const linkField = (label = 'กดแล้วไปที่ (ไม่บังคับ)') => txt('link', label, { max: 300, ph: '/history · /#cat · https://line.me/...' });
            const pic = (label: string) => (
              <div className="field"><span>{label}</span>
                {b.image && <img src={b.image} alt="" className="lb-img" />}
                <div className="lb-row"><button type="button" className="btn sm" disabled={busy || !init.ready} onClick={() => pickFiles(false, ([u]) => patch(b.id, { image: u }))}>{b.image ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</button>
                  {b.image && <button type="button" className="btn ghost sm" onClick={() => patch(b.id, { image: '' })}>เอาออก</button>}</div></div>);
            return (
              <div className="lb-props">
                <div className="lb-props-head"><span aria-hidden>{info.icon}</span><div><b>{info.label}</b><small>{info.desc}</small></div>
                  <button type="button" className="btn ghost sm lb-close" aria-label="ปิด" onClick={() => setSel(null)}>✕</button></div>
                {b.type === 'live' && <>
                  <div className="field"><span>รูปแบบ</span><Seg value={b.variant ?? 'bar'} set={(v) => patch(b.id, { variant: v })} opts={[['bar', 'แถบ'], ['feed', 'การ์ดกิจกรรม'], ['ticker', 'ตัวหนังสือวิ่ง']]} /></div>
                  <div className="field"><span>แสดงอะไรบ้าง</span><Seg value={b.events ?? 'all'} set={(v) => patch(b.id, { events: v })} opts={[['all', 'คนซื้อ + คนสมัคร'], ['buy', 'คนซื้อ'], ['join', 'คนสมัคร']]} /></div>
                  {b.variant === 'feed' && <>
                    <label className="field"><span>ป้ายเล็กด้านบน (ลบให้ว่าง = ไม่แสดง)</span><input className="input" value={b.label ?? 'STORE FEED'} maxLength={40} onChange={(e) => patch(b.id, { label: e.target.value })} /></label>
                    {txt('title', 'หัวข้อการ์ด', { ph: 'กิจกรรมล่าสุด' })}
                    {txt('text', 'คำอธิบายใต้หัวข้อ (ไม่บังคับ)', { rows: 2, max: 200, ph: 'เช่น ลูกค้าซื้อจริงทุกวัน ส่งอัตโนมัติ 24 ชม.' })}
                    <label className="field"><span>ป้ายมุมขวา (ลบให้ว่าง = ไม่แสดง)</span><input className="input" value={b.badge ?? 'อัปเดตสด'} maxLength={30} onChange={(e) => patch(b.id, { badge: e.target.value })} /></label>
                  </>}
                  {(() => { const n = b.limit ?? (b.variant === 'feed' ? 5 : 4); const set = (v: number) => patch(b.id, { limit: Math.min(20, Math.max(1, v)) }); return (
                    <div className="field"><span>แสดงกี่แถว (1–20)</span>
                      <div className="lb-row" style={{ alignItems: 'center', gap: 6 }}>
                        <button type="button" className="btn sm" aria-label="ลด" disabled={n <= 1} onClick={() => set(n - 1)}>−</button>
                        <input className="input" style={{ width: 64, textAlign: 'center' }} inputMode="numeric" value={n} aria-label="จำนวนแถว" onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 1)} />
                        <button type="button" className="btn sm" aria-label="เพิ่ม" disabled={n >= 20} onClick={() => set(n + 1)}>+</button>
                        <span className="muted" style={{ fontSize: 13 }}>แถว</span>
                      </div>
                      <small className="faint">ถ้ามีกิจกรรมน้อยกว่าที่ตั้ง จะแสดงเท่าที่มี</small>
                    </div>); })()}
                  <p className="muted lb-note">ใช้ออเดอร์และการสมัครสมาชิกจริงของร้าน ชื่อลูกค้าถูกปิดบางส่วนให้อัตโนมัติ · ตัวอย่างในหน้านี้เป็นข้อมูลสมมติ</p>
                </>}
                {builtin && b.type !== 'live' && <p className="muted lb-note">{b.type === 'hero' || b.type === 'promos' ? 'รูปของกล่องนี้แก้ได้ที่แท็บ "รูปหน้าแรก · ป๊อปอัป"' : b.type === 'products' ? 'ถ้าซ่อนหรือลบกล่องนี้ ลูกค้าที่ค้นหาจะเห็นผลค้นหาบนสุดแทน' : 'กล่องนี้ใช้ข้อมูลจริงของร้าน ไม่ต้องตั้งค่า'}</p>}
                {TITLED.includes(b.type) && txt('title', b.type === 'spotlight' ? 'ป้ายเล็กด้านบน (ไม่บังคับ)' : b.type === 'quote' ? 'ผู้พูด / ที่มา (ไม่บังคับ)' : 'หัวข้อ')}
                {b.type === 'featured' && <>
                  <div className="field"><span>เลือกสินค้าจาก</span><Seg value={b.pick ?? 'best'} set={(v) => patch(b.id, { pick: v })} opts={[['best', 'ขายดี'], ['cat', 'ตามหมวด'], ['ids', 'เลือกเอง']]} /></div>
                  {b.pick === 'cat' && <label className="field"><span>หมวด</span><select className="input" value={b.category ?? ''} onChange={(e) => patch(b.id, { category: e.target.value })}><option value="">— เลือกหมวด —</option>{init.categories.map((c) => <option key={c}>{c}</option>)}</select></label>}
                  {b.pick === 'ids' && <div className="field"><span>ติ๊กสินค้า (เรียงตามลำดับที่ติ๊ก)</span><div className="lb-picks">{init.products.map((p) => {
                    const on = b.ids?.includes(p.id) ?? false;
                    return <label key={p.id} className={on ? 'on' : ''}><input type="checkbox" checked={on} onChange={() => patch(b.id, { ids: on ? (b.ids ?? []).filter((x) => x !== p.id) : [...(b.ids ?? []), p.id].slice(0, 24) })} />{p.name}</label>;
                  })}</div></div>}
                  <label className="field"><span>จำนวนที่โชว์</span><select className="input" value={b.limit ?? 4} onChange={(e) => patch(b.id, { limit: Number(e.target.value) })}>{[2, 3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n} ชิ้น</option>)}</select></label>
                  <div className="field"><span>รูปแบบ</span><Seg value={b.variant ?? 'grid'} set={(v) => patch(b.id, { variant: v })} opts={[['grid', 'ตาราง'], ['scroll', 'เลื่อนข้าง'], ['list', 'รายการ']]} /></div>
                </>}
                {b.type === 'text' && <>{txt('text', 'ข้อความ', { rows: 5 })}<div className="field"><span>จัดข้อความ</span><Seg value={b.align ?? 'left'} set={(v) => patch(b.id, { align: v })} opts={[['left', 'ชิดซ้าย'], ['center', 'กึ่งกลาง']]} /></div></>}
                {b.type === 'image' && <>{pic('รูป (แนวนอนสวยสุด เช่น 1200×500)')}{linkField()}</>}
                {b.type === 'gallery' && <div className="field"><span>รูปต่อแถว</span><Seg value={b.cols ?? 3} set={(v) => patch(b.id, { cols: v })} opts={[[1, '1'], [2, '2'], [3, '3'], [4, '4']]} /></div>}
                {b.type === 'imgtext' && <>{pic('รูป')}{txt('text', 'ข้อความ', { rows: 4 })}{txt('label', 'ข้อความบนปุ่ม (ไม่บังคับ)', { max: 40 })}{linkField('ปุ่มไปที่')}
                  <div className="field"><span>รูปอยู่ด้าน</span><Seg value={!!b.flip} set={(v) => patch(b.id, { flip: v })} opts={[[false, 'ซ้าย'], [true, 'ขวา']]} /></div></>}
                {b.type === 'notice' && <>{txt('text', 'ข้อความประกาศ', { rows: 2, max: 300 })}<div className="field"><span>สี</span><Seg value={b.tone ?? 'accent'} set={(v) => patch(b.id, { tone: v })} opts={TONES} /></div>{linkField()}</>}
                {b.type === 'button' && <>{txt('label', 'ข้อความบนปุ่ม', { max: 40 })}{linkField('กดแล้วไปที่')}</>}
                {b.type === 'contact' && <>{txt('text', 'ข้อความ (ไม่บังคับ)', { rows: 2, max: 300 })}
                  <p className="muted lb-note">ปุ่ม LINE / Facebook ใช้ลิงก์จากแท็บ &quot;ข้อมูลร้าน&quot; และ &quot;หน้าตาร้าน&quot; ({init.shop.line ? 'มี LINE' : 'ยังไม่มี LINE'} · {init.shop.facebook ? 'มี Facebook' : 'ยังไม่มี Facebook'})</p>
                  {txt('label', 'ปุ่มเพิ่มเติม (ไม่บังคับ)', { max: 40, ph: 'เช่น Instagram' })}{linkField('ปุ่มเพิ่มเติมไปที่')}</>}
                {b.type === 'coupon' && <>{txt('code', 'โค้ด', { max: 40, ph: 'NEW10' })}{txt('text', 'คำอธิบาย (ไม่บังคับ)', { max: 120 })}<p className="muted lb-note">สร้างโค้ดจริงได้ที่เมนู &quot;คูปอง&quot; · กล่องนี้แค่โชว์ให้ลูกค้าคัดลอก</p></>}
                {b.type === 'countdown' && <>
                  <label className="field"><span>นับถึง (เวลาไทย)</span><input className="input" type="datetime-local" value={b.until ?? ''} onChange={(e) => patch(b.id, { until: e.target.value })} /></label>
                  <div className="field"><span>สี</span><Seg value={b.tone ?? 'dark'} set={(v) => patch(b.id, { tone: v })} opts={TONES} /></div>
                  {txt('label', 'ข้อความบนปุ่ม (ไม่บังคับ)', { max: 40 })}{linkField('ปุ่มไปที่')}</>}
                {b.type === 'video' && <label className="field"><span>ลิงก์ YouTube</span><input className="input" value={b.video ?? ''} maxLength={300} placeholder="https://youtu.be/..." onChange={(e) => patch(b.id, { video: e.target.value })} />
                  {b.video && !youtubeId(b.video) && <small style={{ color: 'var(--bad)' }}>ลิงก์ไม่ใช่คลิป YouTube</small>}</label>}
                {b.type === 'realreviews' && <>
                  <label className="field"><span>จำนวนรีวิวที่โชว์</span><select className="input" value={b.limit ?? 6} onChange={(e) => patch(b.id, { limit: Number(e.target.value) })}>{[3, 6, 9, 12].map((n) => <option key={n} value={n}>{n} รีวิว</option>)}</select></label>
                  <div className="field"><span>แสดงเฉพาะรีวิวที่ได้</span><Seg value={b.minStars ?? 1} set={(v) => patch(b.id, { minStars: v })} opts={[[1, 'ทุกคะแนน'], [3, '3★ ขึ้นไป'], [4, '4★ ขึ้นไป'], [5, '5★ เท่านั้น']]} /></div>
                  <label className="field"><span>รีวิวของสินค้า</span><select className="input" value={b.ids?.[0] ?? ''} onChange={(e) => patch(b.id, { ids: e.target.value ? [e.target.value] : [] })}><option value="">ทุกสินค้าในร้าน</option>{init.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                  <p className="muted lb-note">ลูกค้ารีวิวได้ที่หน้าประวัติการซื้อหลังได้ของ · ซ่อน / ตอบรีวิวได้ที่เมนู &quot;รีวิว&quot;</p>
                </>}
                {b.type === 'heading' && <>{txt('text', 'คำอธิบาย (ไม่บังคับ)', { rows: 2, max: 300 })}
                  <div className="field"><span>ขนาดหัวข้อ</span><Seg value={b.size ?? 'm'} set={(v) => patch(b.id, { size: v })} opts={[['s', 'เล็ก'], ['m', 'กลาง'], ['l', 'ใหญ่']]} /></div>
                  <div className="field"><span>จัดข้อความ</span><Seg value={b.align ?? 'center'} set={(v) => patch(b.id, { align: v })} opts={[['left', 'ชิดซ้าย'], ['center', 'กึ่งกลาง']]} /></div></>}
                {b.type === 'cta' && <>{txt('text', 'ข้อความรอง', { rows: 2, max: 300 })}{txt('label', 'ข้อความบนปุ่ม', { max: 40 })}{linkField('ปุ่มไปที่')}{pic('รูปพื้นหลัง (ไม่บังคับ)')}
                  {!b.image && <div className="field"><span>สีพื้น</span><Seg value={b.tone ?? 'accent'} set={(v) => patch(b.id, { tone: v })} opts={TONES} /></div>}</>}
                {(b.type === 'features' || b.type === 'numbers' || b.type === 'linkcards') && <div className="field"><span>ต่อแถว (จอคอม)</span><Seg value={b.cols ?? 3} set={(v) => patch(b.id, { cols: v })} opts={[[1, '1'], [2, '2'], [3, '3'], [4, '4']]} /></div>}
                {b.type === 'pricelist' && txt('text', 'หมายเหตุใต้ตาราง (ไม่บังคับ)', { max: 200 })}
                {b.type === 'marquee' && <>{txt('text', 'ข้อความวิ่ง', { rows: 2, max: 300 })}<div className="field"><span>สีพื้น</span><Seg value={b.tone ?? 'dark'} set={(v) => patch(b.id, { tone: v })} opts={TONES} /></div></>}
                {b.type === 'spotlight' && <>
                  <label className="field"><span>สินค้า</span><select className="input" value={b.ids?.[0] ?? ''} onChange={(e) => patch(b.id, { ids: e.target.value ? [e.target.value] : [] })}><option value="">ขายดีที่สุด (อัตโนมัติ)</option>{init.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                  {txt('text', 'คำอธิบาย (ว่าง = ใช้คำอธิบายของสินค้า)', { rows: 3, max: 500 })}{txt('label', 'ข้อความบนปุ่ม', { max: 40 })}</>}
                {b.type === 'quote' && <>{txt('text', 'ข้อความ', { rows: 3, max: 300 })}<div className="field"><span>จัดข้อความ</span><Seg value={b.align ?? 'center'} set={(v) => patch(b.id, { align: v })} opts={[['left', 'ชิดซ้าย (มีเส้นข้าง)'], ['center', 'กึ่งกลาง']]} /></div></>}
                {ITEM_SPEC[b.type] && renderItems(b)}
                {b.type === 'space' && <div className="field"><span>ขนาด</span><Seg value={b.size ?? 'm'} set={(v) => patch(b.id, { size: v })} opts={[['s', 'เล็ก'], ['m', 'กลาง'], ['l', 'ใหญ่']]} /></div>}
                {b.type !== 'space' && b.type !== 'divider' && styleEditor(b)}
                {HALF_OK.includes(b.type) && <div className="field"><span>ความกว้าง</span><Seg value={!!b.half} set={(v) => patch(b.id, { half: v })} opts={[[false, 'เต็มแถว'], [true, 'ครึ่งแถว']]} />
                  <small className="faint">ครึ่งแถว 2 กล่องติดกัน = วางคู่กันบนจอคอม (มือถือเรียงลงมา)</small></div>}
                <div className="lb-row lb-props-foot">
                  <button type="button" className="btn ghost sm" onClick={() => patch(b.id, { on: !b.on })}>{b.on ? '👁 ซ่อนกล่องนี้' : '👁 แสดงกล่องนี้'}</button>
                  {!builtin && <button type="button" className="btn ghost sm" onClick={() => duplicate(selIdx)}>⧉ ทำซ้ำ</button>}
                  <button type="button" className="btn ghost sm danger" onClick={() => remove(selIdx)}>🗑 ลบ</button>
                </div>
              </div>
            );
          })()}
        </aside>
      </div>
      {ghost && <div className="lb-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.label}</div>}
      {tplOpen && (
        <div className="cmd-bg open lb-tpl-bg" onClick={(e) => { if (e.target === e.currentTarget) setTplOpen(false); }}>
          <div className="card lb-tpl" role="dialog" aria-label="เลือกแม่แบบ">
            <div className="lb-tpl-head"><div><h2>เลือกแม่แบบ</h2><small className="muted">กดใช้แล้วกล่องในหน้า &quot;{curPage ? curPage.title : 'หน้าแรก'}&quot; จะถูกแทนที่ · แก้ข้อความ รูป ลิงก์ต่อได้ทุกกล่อง · ยังไม่บันทึกจนกว่าจะกด &quot;บันทึก&quot;</small></div>
              <button type="button" className="btn ghost sm" aria-label="ปิด" onClick={() => setTplOpen(false)}>✕</button></div>
            {(curPage ? [['page', 'แม่แบบหน้าเพิ่มเติม'], ['home', 'แม่แบบหน้าแรก']] as const : [['home', 'แม่แบบหน้าแรก'], ['page', 'แม่แบบหน้าเพิ่มเติม']] as const).map(([kind, label]) => (
              <div key={kind} className="lb-tpl-group"><b>{label}</b>
                <div className="lb-tpl-grid">{LAYOUT_TEMPLATES.filter((t) => t.kind === kind).map((t) => (
                  <button key={t.key} type="button" className="lb-tpl-card" onClick={() => applyTemplate(t)}>
                    <div className="lb-tpl-map" aria-hidden>{tplShapes[t.key].slice(0, 9).map((b, i) => <span key={i} className={`t-${b.type}${b.half ? ' half' : ''}`}>{BLOCK_INFO[b.type].icon}</span>)}</div>
                    <b>{t.icon} {t.name}</b><small>{t.desc}</small>
                  </button>))}</div>
              </div>))}
          </div>
        </div>
      )}
    </section>
  );
}
