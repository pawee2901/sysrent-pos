'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import { BLOCK_INFO, BUILTIN, DEFAULT_LAYOUT, HALF_OK, LAYOUT_MAX, newBlock, youtubeId, type Block, type BlockType } from '@/lib/home-layout';

export type LayoutInit = { ready: boolean; blocks: Block[]; products: { id: string; name: string; category: string }[]; categories: string[] };

const ADD_ORDER: BlockType[] = ['featured', 'text', 'image', 'notice', 'button', 'video', 'space', ...BUILTIN];
const TONES: [NonNullable<Block['tone']>, string][] = [['accent', 'สีร้าน'], ['ok', 'เขียว'], ['warn', 'ส้ม'], ['info', 'ฟ้า']];
/** ความสูงของกล่องในผังหน้าเว็บ (px) */
const MAP_H: Record<BlockType, number> = { hero: 64, promos: 30, live: 12, stats: 22, products: 80, how: 30, featured: 46, text: 30, image: 40, notice: 14, button: 14, video: 44, space: 8 };

/** สรุปสั้น ๆ ใต้ชื่อกล่อง */
function summary(b: Block): string {
  if (b.type === 'featured') return `${b.title || 'สินค้าแนะนำ'} · ${b.pick === 'cat' ? `หมวด ${b.category || '—'}` : b.pick === 'ids' ? `เลือกเอง ${b.ids?.length ?? 0} ชิ้น` : 'ขายดี'} · ${b.limit ?? 4} ชิ้น`;
  if (b.type === 'text') return b.title || b.text?.slice(0, 40) || 'ยังไม่ได้ใส่ข้อความ';
  if (b.type === 'image') return b.image ? (b.link ? `กดแล้วไป ${b.link}` : 'มีรูปแล้ว') : 'ยังไม่ได้อัปรูป';
  if (b.type === 'notice') return b.text?.slice(0, 50) || 'ยังไม่ได้ใส่ข้อความ';
  if (b.type === 'button') return `${b.label || '—'}${b.link ? ` → ${b.link}` : ''}`;
  if (b.type === 'video') return youtubeId(b.video) ? 'มีคลิปแล้ว' : 'ยังไม่ได้ใส่ลิงก์';
  if (b.type === 'space') return b.size === 's' ? 'เล็ก' : b.size === 'l' ? 'ใหญ่' : 'กลาง';
  return BLOCK_INFO[b.type].desc;
}
/** กล่องที่ยังไม่ได้กรอกของ = หน้าร้านไม่แสดง */
const empty = (b: Block) => (b.type === 'text' && !b.title && !b.text) || (b.type === 'image' && !b.image) || (b.type === 'notice' && !b.text)
  || (b.type === 'button' && !b.label) || (b.type === 'video' && !youtubeId(b.video));

/** จัดหน้าแรกเอง: เพิ่ม / ลาก-เลื่อน / ซ่อน / ลบกล่อง · ผังหน้าเว็บด้านข้าง */
export function HomeLayout({ init }: { init: LayoutInit }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(init.blocks);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const drag = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  const [picFor, setPicFor] = useState('');

  const update = (next: Block[]) => { setBlocks(next); setDirty(true); };
  const patch = (id: string, p: Partial<Block>) => update(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const a = [...blocks]; const [x] = a.splice(from, 1); a.splice(to, 0, x); update(a);
  };
  const has = (t: BlockType) => blocks.some((b) => b.type === t);
  function add(t: BlockType) {
    const b = newBlock(t);
    update([...blocks, b]); setAdding(false);
    if (!BUILTIN.includes(t) && t !== 'space') setOpen(b.id);
    setTimeout(() => document.getElementById(`lay-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }
  async function upload(fl: File | undefined) {
    if (!fl || !picFor) return;
    setBusy(true);
    const fd = new FormData(); fd.append('file', fl);
    const r = await api<{ url: string }>('/api/admin/upload', fd);
    setBusy(false);
    if (r.ok) patch(picFor, { image: r.data.url }); else notify(r.error, 'error');
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
    setBlocks(DEFAULT_LAYOUT); setOpen(null); save([], 'กลับเป็นหน้าแรกแบบเดิมแล้ว ✓');
  }

  // ผังหน้าเว็บ: จับคู่กล่องครึ่งแถวแบบเดียวกับหน้าร้าน
  const shown = blocks.filter((b) => b.on);
  const mapRows: Block[][] = [];
  for (let i = 0; i < shown.length; i++) {
    const b = shown[i], n = shown[i + 1];
    const half = (x?: Block) => !!x?.half && HALF_OK.includes(x.type);
    if (half(b) && half(n)) { mapRows.push([b, n!]); i++; } else mapRows.push([b]);
  }

  return (
    <section className="card">
      <div className="card-head"><h2>จัดหน้าแรก</h2>
        {dirty && <span className="pill warn">ยังไม่ได้บันทึก</span>}
        <a href="/" target="_blank" rel="noopener" className="btn ghost sm">ดูหน้าร้าน ↗</a>
        <button type="button" className="btn primary sm" disabled={busy || !init.ready} onClick={() => save()}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>
      <div className="form">
        {!init.ready && <p style={{ color: 'var(--warn)', margin: 0 }}>⚠️ ต้องรัน SQL <code>0034_shop_home_layout.sql</code> ใน Supabase ก่อน</p>}
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>เพิ่มกล่องที่อยากได้ แล้วลาก ⋮⋮ หรือกด ↑ ↓ เพื่อย้ายที่ · 👁 ซ่อนชั่วคราว · กล่องที่ตั้ง &quot;ครึ่งแถว&quot; 2 กล่องติดกันจะวางคู่กันบนจอคอม</p>
        <input ref={pick} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="lay">
          <ol className="lay-list">
            {blocks.map((b, i) => {
              const info = BLOCK_INFO[b.type], isOpen = open === b.id, builtin = BUILTIN.includes(b.type);
              return (
                <li key={b.id} id={`lay-${b.id}`} className={`lay-item${b.on ? '' : ' off'}${over === i ? ' over' : ''}${isOpen ? ' open' : ''}`}
                  onDragOver={(e) => { if (drag.current === null) return; e.preventDefault(); setOver(i); }}
                  onDragLeave={() => setOver((o) => (o === i ? null : o))}
                  onDrop={(e) => { e.preventDefault(); if (drag.current !== null) move(drag.current, i); drag.current = null; setOver(null); }}>
                  <div className="lay-row">
                    <span className="lay-grip" draggable aria-label="ลากเพื่อย้าย" title="ลากเพื่อย้าย"
                      onDragStart={(e) => { drag.current = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', b.id); }}
                      onDragEnd={() => { drag.current = null; setOver(null); }}>⋮⋮</span>
                    <span className="lay-ic" aria-hidden>{info.icon}</span>
                    <button type="button" className="lay-name" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen}>
                      <b>{info.label}{b.half && HALF_OK.includes(b.type) && <small className="pill plain">ครึ่งแถว</small>}{empty(b) && <small className="pill warn">ยังไม่แสดง</small>}</b>
                      <span>{summary(b)}</span>
                    </button>
                    <div className="lay-acts">
                      <button type="button" className="btn ghost sm" disabled={i === 0} aria-label={`เลื่อน ${info.label} ขึ้น`} onClick={() => move(i, i - 1)}>↑</button>
                      <button type="button" className="btn ghost sm" disabled={i === blocks.length - 1} aria-label={`เลื่อน ${info.label} ลง`} onClick={() => move(i, i + 1)}>↓</button>
                      <button type="button" className="btn ghost sm" aria-pressed={!b.on} title={b.on ? 'ซ่อน' : 'แสดง'} aria-label={b.on ? `ซ่อน ${info.label}` : `แสดง ${info.label}`} onClick={() => patch(b.id, { on: !b.on })}>{b.on ? '👁' : '🚫'}</button>
                      <button type="button" className="btn ghost sm" aria-label={`ลบ ${info.label}`} onClick={() => { update(blocks.filter((x) => x.id !== b.id)); if (isOpen) setOpen(null); }}>✕</button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="lay-edit">
                      {builtin && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{info.desc}{b.type === 'hero' || b.type === 'promos' ? ' · แก้รูปได้ที่แท็บ "รูปหน้าแรก · ป๊อปอัป"' : ''}{b.type === 'products' ? ' · ถ้าซ่อนกล่องนี้ ลูกค้าที่ค้นหาจะเห็นผลค้นหาด้านบนสุดแทน' : ''}</p>}
                      {(b.type === 'featured' || b.type === 'text' || b.type === 'video') && (
                        <label className="field"><span>หัวข้อ{b.type === 'video' ? ' (ไม่บังคับ)' : ''}</span><input className="input" value={b.title ?? ''} maxLength={80} onChange={(e) => patch(b.id, { title: e.target.value })} /></label>)}
                      {b.type === 'featured' && <>
                        <div className="field"><span>เลือกสินค้าจาก</span>
                          <div className="chips">{([['best', 'ขายดีที่สุด'], ['cat', 'ตามหมวด'], ['ids', 'เลือกเอง']] as const).map(([k, l]) => (
                            <button key={k} type="button" className={`chip${(b.pick ?? 'best') === k ? ' on' : ''}`} onClick={() => patch(b.id, { pick: k })}>{l}</button>))}</div></div>
                        {b.pick === 'cat' && <label className="field"><span>หมวด</span>
                          <select className="input" value={b.category ?? ''} onChange={(e) => patch(b.id, { category: e.target.value })}>
                            <option value="">— เลือกหมวด —</option>{init.categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>}
                        {b.pick === 'ids' && <div className="field"><span>ติ๊กสินค้าที่จะโชว์ (เรียงตามที่ติ๊ก)</span>
                          <div className="lay-picks">{init.products.map((p) => {
                            const on = b.ids?.includes(p.id) ?? false;
                            return <label key={p.id} className={`lay-pick${on ? ' on' : ''}`}><input type="checkbox" checked={on} onChange={() => patch(b.id, { ids: on ? (b.ids ?? []).filter((x) => x !== p.id) : [...(b.ids ?? []), p.id].slice(0, 24) })} />{p.name}</label>;
                          })}{!init.products.length && <span className="muted">ยังไม่มีสินค้า</span>}</div></div>}
                        <label className="field"><span>จำนวนที่โชว์</span>
                          <select className="input" value={b.limit ?? 4} onChange={(e) => patch(b.id, { limit: Number(e.target.value) })}>{[2, 3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n} ชิ้น</option>)}</select></label>
                      </>}
                      {b.type === 'text' && <>
                        <label className="field"><span>ข้อความ</span><textarea className="input" rows={4} value={b.text ?? ''} maxLength={1000} placeholder="เช่น ร้านเปิด 9:00–24:00 · ทุกแอปรับประกันตลอดอายุ" onChange={(e) => patch(b.id, { text: e.target.value })} /></label>
                        <div className="field"><span>จัดข้อความ</span><div className="chips">{([['left', 'ชิดซ้าย'], ['center', 'กึ่งกลาง']] as const).map(([k, l]) => <button key={k} type="button" className={`chip${(b.align ?? 'left') === k ? ' on' : ''}`} onClick={() => patch(b.id, { align: k })}>{l}</button>)}</div></div>
                      </>}
                      {b.type === 'image' && <div className="field"><span>รูป (แนวนอนสวยสุด เช่น 1200×500)</span>
                        {b.image && <img src={b.image} alt="" className="lay-img" />}
                        <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn sm" disabled={busy || !init.ready} onClick={() => { setPicFor(b.id); pick.current?.click(); }}>{b.image ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</button>
                          {b.image && <button type="button" className="btn ghost sm" onClick={() => patch(b.id, { image: '' })}>เอาออก</button>}</div></div>}
                      {b.type === 'notice' && <>
                        <label className="field"><span>ข้อความประกาศ</span><textarea className="input" rows={2} value={b.text ?? ''} maxLength={300} placeholder="เช่น 🎉 ลด 10% ทุกแอป ถึงสิ้นเดือนนี้" onChange={(e) => patch(b.id, { text: e.target.value })} /></label>
                        <div className="field"><span>สี</span><div className="chips">{TONES.map(([k, l]) => <button key={k} type="button" className={`chip${(b.tone ?? 'accent') === k ? ' on' : ''}`} onClick={() => patch(b.id, { tone: k })}>{l}</button>)}</div></div>
                      </>}
                      {b.type === 'button' && <label className="field"><span>ข้อความบนปุ่ม</span><input className="input" value={b.label ?? ''} maxLength={40} onChange={(e) => patch(b.id, { label: e.target.value })} /></label>}
                      {(b.type === 'image' || b.type === 'notice' || b.type === 'button') && (
                        <label className="field"><span>กดแล้วไปที่{b.type === 'button' ? '' : ' (ไม่บังคับ)'}</span><input className="input" value={b.link ?? ''} maxLength={300} placeholder="/history หรือ https://line.me/..." onChange={(e) => patch(b.id, { link: e.target.value })} /></label>)}
                      {b.type === 'video' && <label className="field"><span>ลิงก์ YouTube</span><input className="input" value={b.video ?? ''} maxLength={300} placeholder="https://youtu.be/..." onChange={(e) => patch(b.id, { video: e.target.value })} />
                        {b.video && !youtubeId(b.video) && <small style={{ color: 'var(--bad)' }}>ลิงก์ไม่ใช่คลิป YouTube</small>}</label>}
                      {b.type === 'space' && <div className="field"><span>ขนาด</span><div className="chips">{([['s', 'เล็ก'], ['m', 'กลาง'], ['l', 'ใหญ่']] as const).map(([k, l]) => <button key={k} type="button" className={`chip${(b.size ?? 'm') === k ? ' on' : ''}`} onClick={() => patch(b.id, { size: k })}>{l}</button>)}</div></div>}
                      {HALF_OK.includes(b.type) && <div className="field"><span>ความกว้าง</span><div className="chips">
                        <button type="button" className={`chip${b.half ? '' : ' on'}`} onClick={() => patch(b.id, { half: false })}>เต็มแถว</button>
                        <button type="button" className={`chip${b.half ? ' on' : ''}`} onClick={() => patch(b.id, { half: true })}>ครึ่งแถว</button></div></div>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <aside className="lay-map" aria-label="ผังหน้าแรก">
            <b>ผังหน้าแรก</b>
            <div className="lay-phone">
              <div className="lay-bar" />
              {mapRows.length ? mapRows.map((row) => (
                <div key={row[0].id} className={`lay-mrow${row.length > 1 ? ' pair' : ''}`}>
                  {row.map((b) => <button key={b.id} type="button" className={`lay-mbox t-${b.type}${open === b.id ? ' on' : ''}${empty(b) ? ' empty' : ''}`} style={{ height: MAP_H[b.type] }} onClick={() => { setOpen(b.id); document.getElementById(`lay-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                    <span>{BLOCK_INFO[b.type].icon} {b.type === 'space' ? '' : BLOCK_INFO[b.type].label}</span></button>)}
                </div>)) : <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>ยังไม่มีกล่อง</p>}
            </div>
            <small className="faint">กดกล่องในผังเพื่อแก้ไข</small>
          </aside>
        </div>
        {adding ? (
          <div className="lay-add">
            <div className="lay-add-head"><b>เลือกกล่องที่จะเพิ่ม</b><button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>ปิด</button></div>
            <div className="lay-add-grid">{ADD_ORDER.map((t) => {
              const taken = BUILTIN.includes(t) && has(t);
              return <button key={t} type="button" className="lay-add-item" disabled={taken} onClick={() => add(t)}>
                <span aria-hidden>{BLOCK_INFO[t].icon}</span><b>{BLOCK_INFO[t].label}</b><small>{taken ? 'มีอยู่แล้ว' : BLOCK_INFO[t].desc}</small></button>;
            })}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" disabled={blocks.length >= LAYOUT_MAX || !init.ready} onClick={() => setAdding(true)}>＋ เพิ่มกล่อง</button>
            <button type="button" className="btn ghost" disabled={busy || !init.ready} onClick={reset}>กลับเป็นแบบเดิม</button>
          </div>
        )}
      </div>
    </section>
  );
}
