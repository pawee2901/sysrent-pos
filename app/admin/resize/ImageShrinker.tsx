'use client';
import { useEffect, useRef, useState } from 'react';
import css from './shrink.module.css';

type Fmt = 'image/webp' | 'image/jpeg' | 'image/png';
type Item = { id: number; name: string; before: number; after: number; w: number; h: number; url: string; type: Fmt; err?: string };
const SIZES: [number, string][] = [[0, 'ขนาดเดิม'], [2560, '2560 px'], [1920, '1920 px'], [1280, '1280 px'], [800, '800 px (โลโก้)'], [512, '512 px']];
const FMTS: [Fmt, string, string][] = [['image/webp', 'WebP', 'เล็กสุด · แนะนำสำหรับเว็บ'], ['image/jpeg', 'JPG', 'เปิดได้ทุกที่'], ['image/png', 'PNG', 'พื้นใส · ไฟล์ใหญ่']];
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const EXT: Record<Fmt, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** ย่อรูปในเบราว์เซอร์ (ไม่อัปไฟล์ขึ้นเซิร์ฟเวอร์) · เลือกขนาด / ชนิด / คุณภาพ → ดาวน์โหลด */
export function ImageShrinker() {
  const [max, setMax] = useState(1920);
  const [fmt, setFmt] = useState<Fmt>('image/webp');
  const [q, setQ] = useState(82);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const files = useRef(new Map<number, File>());
  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function shrink(file: File, id: number): Promise<Item> {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      const scale = max ? Math.min(1, max / Math.max(bmp.width, bmp.height)) : 1;
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d')!;
      if (fmt === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); } // JPG ไม่มีพื้นใส → ใส่พื้นขาว
      ctx.drawImage(bmp, 0, 0, w, h); bmp.close();
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, fmt, q / 100));
      if (!blob) throw new Error('x');
      return { id, name: file.name.replace(/\.[^.]+$/, ''), before: file.size, after: blob.size, w, h, url: URL.createObjectURL(blob), type: blob.type as Fmt };
    } catch { return { id, name: file.name, before: file.size, after: 0, w: 0, h: 0, url: '', type: fmt, err: 'เปิดรูปนี้ไม่ได้' }; }
  }
  async function add(list: File[]) {
    const imgs = list.filter((f) => f.type.startsWith('image/')).slice(0, 30);
    if (!imgs.length) return;
    setBusy(true);
    const made: Item[] = [];
    for (const f of imgs) { const id = ++seq.current; files.current.set(id, f); made.push(await shrink(f, id)); }
    setItems((x) => [...made, ...x]);
    setBusy(false);
  }
  /** เปลี่ยนตัวเลือกแล้วย่อรูปเดิมใหม่ทั้งหมด */
  async function redo() {
    if (!items.length) return;
    setBusy(true);
    const next: Item[] = [];
    for (const it of items) { const f = files.current.get(it.id); if (f) { URL.revokeObjectURL(it.url); next.push(await shrink(f, it.id)); } }
    setItems(next); setBusy(false);
  }
  useEffect(() => { redo(); }, [max, fmt, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (it: Item) => { const a = document.createElement('a'); a.href = it.url; a.download = `${it.name}-${it.w}px.${EXT[it.type] ?? 'img'}`; a.click(); };
  async function saveAll() { for (const it of items.filter((x) => x.url)) { save(it); await new Promise((r) => setTimeout(r, 250)); } }
  const totalBefore = items.reduce((s, i) => s + i.before, 0), totalAfter = items.reduce((s, i) => s + i.after, 0);

  return (
    <>
      <div className="page-head"><div><h1>ย่อรูป</h1><p>ย่อรูปก่อนอัป หรือย่อไปใช้ที่อื่น (Facebook · LINE · แชท) · ทำในเครื่องของคุณ ไม่ส่งรูปขึ้นเซิร์ฟเวอร์</p></div>
        {items.length > 1 && <div className="acts"><button type="button" className="btn primary" onClick={saveAll}>⬇️ ดาวน์โหลดทั้งหมด ({items.length})</button></div>}</div>
      <div className={`card card-pad ${css.note}`}>💡 รูปที่อัปในหลังบ้าน (สินค้า · ตั้งค่าร้าน · จัดหน้าร้าน) ระบบ<b>ย่อให้อัตโนมัติก่อนอัป</b>อยู่แล้ว ใช้หน้านี้เมื่ออยากได้ไฟล์ที่ย่อแล้วไปใช้เอง</div>
      <section className="card">
        <div className="form">
          <div className="field"><span>ขนาด (ด้านยาวสุด)</span><div className="ap-picks">{SIZES.map(([v, l]) => <button key={v} type="button" className={`ap-pick${max === v ? ' on' : ''}`} onClick={() => setMax(v)}>{l}</button>)}</div></div>
          <div className="field"><span>ชนิดไฟล์</span><div className="ap-picks">{FMTS.map(([v, l, d]) => <button key={v} type="button" title={d} className={`ap-pick${fmt === v ? ' on' : ''}`} onClick={() => setFmt(v)}>{l} <small className="muted">· {d}</small></button>)}</div></div>
          {fmt !== 'image/png' && <label className="field"><span>คุณภาพ {q}% <small className="muted">(80–85 = คมพอ ไฟล์เล็ก)</small></span><input type="range" min={40} max={95} value={q} onChange={(e) => setQ(Number(e.target.value))} /></label>}
          <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ''; }} />
          <button type="button" className={`${css.drop}${over ? ` ${css.over}` : ''}`} onClick={() => pick.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); }}>
            <span aria-hidden>🗜️</span><b>{busy ? 'กำลังย่อ…' : 'แตะเพื่อเลือกรูป หรือลากรูปมาวาง'}</b><small className="muted">เลือกได้หลายรูป (สูงสุด 30 รูปต่อครั้ง)</small>
          </button>
        </div>
      </section>
      {items.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>{items.length} รูป</h2>{totalAfter > 0 && <span className="pill ok">{kb(totalBefore)} → {kb(totalAfter)} · เล็กลง {Math.max(0, Math.round((1 - totalAfter / totalBefore) * 100))}%</span>}
            <button type="button" className="btn ghost sm" onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.url)); files.current.clear(); setItems([]); }}>ล้าง</button></div>
          <div className={css.list}>{items.map((it) => (
            <div key={it.id} className={css.item}>
              {it.url ? <img src={it.url} alt={it.name} /> : <div className={css.bad}>⚠️</div>}
              <div className={css.meta}><b>{it.name}</b>
                {it.err ? <small style={{ color: 'var(--bad)' }}>{it.err}</small>
                  : <small className="muted">{it.w}×{it.h} · {kb(it.before)} → <b style={{ color: it.after < it.before ? 'var(--ok)' : 'var(--warn)' }}>{kb(it.after)}</b>{it.after < it.before ? ` (−${Math.round((1 - it.after / it.before) * 100)}%)` : ' (ใหญ่ขึ้น ลองลดคุณภาพ / เปลี่ยนเป็น WebP)'}</small>}</div>
              {it.url && <button type="button" className="btn sm" onClick={() => save(it)}>⬇️ ดาวน์โหลด</button>}
            </div>))}</div>
        </section>
      )}
    </>
  );
}
