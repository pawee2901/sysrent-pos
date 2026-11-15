'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import { AppLogo } from '@/components/AppLogo';
import { splitLeft, untilMs } from '@/components/HomeBits';
import { BLOCK_INFO, BUILTIN, DEFAULT_LAYOUT, HALF_OK, ITEMS_MAX, LAYOUT_MAX, PALETTE, newBlock, newBlockId, youtubeId, type Block, type BlockItem, type BlockType } from '@/lib/home-layout';

type P = { id: string; name: string; category: string; image: string; template: string; from: number | null; sold: number };
export type LayoutInit = {
  ready: boolean; blocks: Block[]; products: P[]; categories: string[];
  shop: { name: string; tagline: string; banner: string; line: boolean; facebook: boolean }; promos: string[];
};
type Drag = { kind: 'new'; type: BlockType } | { kind: 'move'; id: string };

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
    case 'live': return <div className="cv-live"><i />@s***a ซื้อ {d.products[0]?.name ?? 'สินค้า'} · 5 นาทีที่แล้ว</div>;
    case 'stats': return <div className="cv-cols" style={{ ['--c' as string]: 3 } as React.CSSProperties}>{['สมาชิก', 'ขายไปแล้ว', 'พร้อมส่ง'].map((x) => <div key={x} className="cv-stat"><b>123</b><small>{x}</small></div>)}</div>;
    case 'products': return <>{head('สินค้าทั้งหมด')}{d.categories.length > 1 && <div className="cv-chips"><span className="on">ทั้งหมด</span>{d.categories.slice(0, 5).map((c) => <span key={c}>{c}</span>)}</div>}<Cards list={d.products.slice(0, 8)} /></>;
    case 'how': return <>{head('ซื้อง่าย 3 ขั้นตอน')}<div className="cv-cols" style={{ ['--c' as string]: 3 } as React.CSSProperties}>{['เลือกแอป', 'สแกนจ่าย', 'ได้รหัสทันที'].map((x, i) => <div key={x} className="cv-stat"><b>{i + 1}</b><small>{x}</small></div>)}</div></>;
    case 'featured': return <>{head(b.title || 'สินค้าแนะนำ')}<Cards list={pickProducts(b, d.products)} /></>;
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
    case 'space': return <div className={`cv-space ${b.size ?? 'm'}`}>ช่องว่าง</div>;
  }
}

/** จัดหน้าแรกแบบลากวาง: แถบกล่อง (ซ้าย) · หน้าร้านจำลอง (กลาง) · ตั้งค่ากล่องที่เลือก (ขวา) */
export function HomeLayout({ init }: { init: LayoutInit }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(init.blocks);
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
      const fd = new FormData(); fd.append('file', fl);
      const r = await api<{ url: string }>('/api/admin/upload', fd);
      if (r.ok) urls.push(r.data.url); else { notify(r.error, 'error'); break; }
    }
    setBusy(false);
    if (urls.length) onFiles.current(urls);
  }

  async function save(list = blocks, done = 'บันทึกหน้าแรกแล้ว ✓') {
    setBusy(true);
    const r = await api('/api/admin/settings', { action: 'layout', blocks: list });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    setDirty(false); notify(done); router.refresh();
  }
  async function reset() {
    if (!(await ask('กลับไปใช้หน้าแรกแบบเดิม?', { text: 'กล่องที่เพิ่มเองจะหายทั้งหมด', ok: 'กลับเป็นแบบเดิม', danger: true }))) return;
    setBlocks(DEFAULT_LAYOUT); setSel(null); save([], 'กลับเป็นหน้าแรกแบบเดิมแล้ว ✓');
  }

  const setItem = (b: Block, i: number, p: Partial<BlockItem>) => patch(b.id, { items: (b.items ?? []).map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const dropLine = (i: number) => (ghost && drop === i ? <div key={`drop${i}`} className="cv-drop" /> : null);

  return (
    <section className="card lb">
      <div className="lb-top">
        <div><h2>จัดหน้าแรก</h2><small className="muted">ลากกล่องจากด้านซ้ายไปวางบนหน้าร้าน · กดกล่องเพื่อแก้ไข · ลากกล่องบนหน้าร้านเพื่อย้ายที่</small></div>
        <div className="lb-top-acts">
          <Seg value={view} set={setView} opts={[['pc', '🖥 คอม'], ['phone', '📱 มือถือ']]} />
          <button type="button" className="btn ghost sm" disabled={busy || !init.ready} onClick={reset}>กลับเป็นแบบเดิม</button>
          <a href="/" target="_blank" rel="noopener" className="btn ghost sm">ดูหน้าร้าน ↗</a>
          <button type="button" className="btn primary sm" disabled={busy || !init.ready} onClick={() => save()}>{busy ? 'กำลังบันทึก…' : dirty ? 'บันทึก •' : 'บันทึก'}</button>
        </div>
      </div>
      {!init.ready && <p className="lb-warn">⚠️ ต้องรัน SQL <code>0034_shop_home_layout.sql</code> ใน Supabase ก่อน ถึงจะบันทึกได้</p>}
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
                    <div className="cv-body"><Preview b={b} d={init} /></div>
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
                {builtin && <p className="muted lb-note">{b.type === 'hero' || b.type === 'promos' ? 'รูปของกล่องนี้แก้ได้ที่แท็บ "รูปหน้าแรก · ป๊อปอัป"' : b.type === 'products' ? 'ถ้าซ่อนหรือลบกล่องนี้ ลูกค้าที่ค้นหาจะเห็นผลค้นหาบนสุดแทน' : 'กล่องนี้ใช้ข้อมูลจริงของร้าน ไม่ต้องตั้งค่า'}</p>}
                {(b.type === 'featured' || b.type === 'cats' || b.type === 'text' || b.type === 'video' || b.type === 'imgtext' || b.type === 'contact' || b.type === 'faq' || b.type === 'coupon' || b.type === 'countdown') && txt('title', 'หัวข้อ')}
                {b.type === 'featured' && <>
                  <div className="field"><span>เลือกสินค้าจาก</span><Seg value={b.pick ?? 'best'} set={(v) => patch(b.id, { pick: v })} opts={[['best', 'ขายดี'], ['cat', 'ตามหมวด'], ['ids', 'เลือกเอง']]} /></div>
                  {b.pick === 'cat' && <label className="field"><span>หมวด</span><select className="input" value={b.category ?? ''} onChange={(e) => patch(b.id, { category: e.target.value })}><option value="">— เลือกหมวด —</option>{init.categories.map((c) => <option key={c}>{c}</option>)}</select></label>}
                  {b.pick === 'ids' && <div className="field"><span>ติ๊กสินค้า (เรียงตามลำดับที่ติ๊ก)</span><div className="lb-picks">{init.products.map((p) => {
                    const on = b.ids?.includes(p.id) ?? false;
                    return <label key={p.id} className={on ? 'on' : ''}><input type="checkbox" checked={on} onChange={() => patch(b.id, { ids: on ? (b.ids ?? []).filter((x) => x !== p.id) : [...(b.ids ?? []), p.id].slice(0, 24) })} />{p.name}</label>;
                  })}</div></div>}
                  <label className="field"><span>จำนวนที่โชว์</span><select className="input" value={b.limit ?? 4} onChange={(e) => patch(b.id, { limit: Number(e.target.value) })}>{[2, 3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n} ชิ้น</option>)}</select></label>
                </>}
                {b.type === 'text' && <>{txt('text', 'ข้อความ', { rows: 5 })}<div className="field"><span>จัดข้อความ</span><Seg value={b.align ?? 'left'} set={(v) => patch(b.id, { align: v })} opts={[['left', 'ชิดซ้าย'], ['center', 'กึ่งกลาง']]} /></div></>}
                {b.type === 'image' && <>{pic('รูป (แนวนอนสวยสุด เช่น 1200×500)')}{linkField()}</>}
                {b.type === 'gallery' && <>
                  <div className="field"><span>รูป ({(b.items ?? []).length}/{ITEMS_MAX})</span>
                    <div className="lb-gal">{(b.items ?? []).map((x, i) => (
                      <div key={`${x.image}${i}`} className="lb-gal-item">
                        <div><img src={x.image} alt="" /><button type="button" aria-label="ลบรูป" onClick={() => patch(b.id, { items: (b.items ?? []).filter((_, k) => k !== i) })}>✕</button></div>
                        <input className="input" value={x.link ?? ''} maxLength={300} placeholder="ลิงก์ (ไม่บังคับ)" onChange={(e) => setItem(b, i, { link: e.target.value })} />
                      </div>))}</div>
                    {(b.items ?? []).length < ITEMS_MAX && <button type="button" className="btn sm" disabled={busy || !init.ready} onClick={() => pickFiles(true, (urls) => patch(b.id, { items: [...(blocksRef.current.find((x) => x.id === b.id)?.items ?? []), ...urls.map((image) => ({ image, link: '' }))].slice(0, ITEMS_MAX) }))}>＋ เพิ่มรูป</button>}</div>
                  <div className="field"><span>รูปต่อแถว</span><Seg value={b.cols ?? 3} set={(v) => patch(b.id, { cols: v })} opts={[[1, '1'], [2, '2'], [3, '3'], [4, '4']]} /></div>
                </>}
                {b.type === 'imgtext' && <>{pic('รูป')}{txt('text', 'ข้อความ', { rows: 4 })}{txt('label', 'ข้อความบนปุ่ม (ไม่บังคับ)', { max: 40 })}{linkField('ปุ่มไปที่')}
                  <div className="field"><span>รูปอยู่ด้าน</span><Seg value={!!b.flip} set={(v) => patch(b.id, { flip: v })} opts={[[false, 'ซ้าย'], [true, 'ขวา']]} /></div></>}
                {b.type === 'notice' && <>{txt('text', 'ข้อความประกาศ', { rows: 2, max: 300 })}<div className="field"><span>สี</span><Seg value={b.tone ?? 'accent'} set={(v) => patch(b.id, { tone: v })} opts={TONES} /></div>{linkField()}</>}
                {b.type === 'button' && <>{txt('label', 'ข้อความบนปุ่ม', { max: 40 })}{linkField('กดแล้วไปที่')}</>}
                {b.type === 'contact' && <>{txt('text', 'ข้อความ (ไม่บังคับ)', { rows: 2, max: 300 })}
                  <p className="muted lb-note">ปุ่ม LINE / Facebook ใช้ลิงก์จากแท็บ &quot;ข้อมูลร้าน&quot; และ &quot;หน้าตาร้าน&quot; ({init.shop.line ? 'มี LINE' : 'ยังไม่มี LINE'} · {init.shop.facebook ? 'มี Facebook' : 'ยังไม่มี Facebook'})</p>
                  {txt('label', 'ปุ่มเพิ่มเติม (ไม่บังคับ)', { max: 40, ph: 'เช่น Instagram' })}{linkField('ปุ่มเพิ่มเติมไปที่')}</>}
                {b.type === 'faq' && <div className="field"><span>คำถาม ({(b.items ?? []).length}/{ITEMS_MAX})</span>
                  {(b.items ?? []).map((x, i) => (
                    <div key={i} className="lb-qa">
                      <input className="input" value={x.q ?? ''} maxLength={200} placeholder={`คำถามที่ ${i + 1}`} onChange={(e) => setItem(b, i, { q: e.target.value })} />
                      <textarea className="input" rows={2} value={x.a ?? ''} maxLength={1000} placeholder="คำตอบ" onChange={(e) => setItem(b, i, { a: e.target.value })} />
                      <button type="button" className="btn ghost sm" onClick={() => patch(b.id, { items: (b.items ?? []).filter((_, k) => k !== i) })}>ลบคำถามนี้</button>
                    </div>))}
                  {(b.items ?? []).length < ITEMS_MAX && <button type="button" className="btn sm" onClick={() => patch(b.id, { items: [...(b.items ?? []), { q: '', a: '' }] })}>＋ เพิ่มคำถาม</button>}</div>}
                {b.type === 'coupon' && <>{txt('code', 'โค้ด', { max: 40, ph: 'NEW10' })}{txt('text', 'คำอธิบาย (ไม่บังคับ)', { max: 120 })}<p className="muted lb-note">สร้างโค้ดจริงได้ที่เมนู &quot;คูปอง&quot; · กล่องนี้แค่โชว์ให้ลูกค้าคัดลอก</p></>}
                {b.type === 'countdown' && <>
                  <label className="field"><span>นับถึง (เวลาไทย)</span><input className="input" type="datetime-local" value={b.until ?? ''} onChange={(e) => patch(b.id, { until: e.target.value })} /></label>
                  <div className="field"><span>สี</span><Seg value={b.tone ?? 'dark'} set={(v) => patch(b.id, { tone: v })} opts={TONES} /></div>
                  {txt('label', 'ข้อความบนปุ่ม (ไม่บังคับ)', { max: 40 })}{linkField('ปุ่มไปที่')}</>}
                {b.type === 'video' && <label className="field"><span>ลิงก์ YouTube</span><input className="input" value={b.video ?? ''} maxLength={300} placeholder="https://youtu.be/..." onChange={(e) => patch(b.id, { video: e.target.value })} />
                  {b.video && !youtubeId(b.video) && <small style={{ color: 'var(--bad)' }}>ลิงก์ไม่ใช่คลิป YouTube</small>}</label>}
                {b.type === 'space' && <div className="field"><span>ขนาด</span><Seg value={b.size ?? 'm'} set={(v) => patch(b.id, { size: v })} opts={[['s', 'เล็ก'], ['m', 'กลาง'], ['l', 'ใหญ่']]} /></div>}
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
    </section>
  );
}
