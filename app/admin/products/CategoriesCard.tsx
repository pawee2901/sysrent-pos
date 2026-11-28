'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ask, input, notify } from '@/components/dialog';
import { api } from '@/components/Cart';
import { uploadImage } from '@/components/upload';
import { ImgHint } from '@/components/ImgHint';
import css from './cats.module.css';

/**
 * จัดการหมวดหมู่: เพิ่ม · เปลี่ยนชื่อ · เลื่อนลำดับ · ลบ · รูปปกหมวด
 * ลำดับนี้ = ลำดับหมวดบนหน้าร้าน · รูปปก = ใช้กับกล่อง "ปุ่มหมวดสินค้า" แบบรูปปกใหญ่
 */
export function CategoriesCard({ categories, counts, images: imgInit = {}, imgReady = false }: { categories: string[]; counts: Record<string, number>; images?: Record<string, string>; imgReady?: boolean }) {
  const router = useRouter();
  const [list, setList] = useState(categories);
  const [images, setImages] = useState<Record<string, string>>(imgInit);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState('');
  const [err, setErr] = useState('');

  async function push(next: string[], extra: { rename?: { from: string; to: string }; remove?: string } = {}, imgs = images) {
    setBusy(true); setErr('');
    const r = await api('/api/admin/categories', { list: next, ...extra, ...(imgReady ? { images: Object.fromEntries(next.filter((c) => imgs[c]).map((c) => [c, imgs[c]])) } : {}) });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return false; }
    setList(next); setImages(imgs); router.refresh(); return true;
  }
  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (list.includes(n)) { setErr('มีหมวดนี้อยู่แล้ว'); return; }
    push([...list, n]).then((ok) => ok && setName(''));
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
    push(next);
  }
  async function rename(c: string) {
    const to = await input('เปลี่ยนชื่อหมวด', { value: c, max: 30, ok: 'บันทึก', text: 'สินค้าในหมวดนี้จะย้ายไปชื่อใหม่ให้เอง' });
    if (!to || to === c) return;
    if (list.includes(to)) { setErr('มีหมวดนี้อยู่แล้ว'); return; }
    const imgs = { ...images }; if (imgs[c]) { imgs[to] = imgs[c]; delete imgs[c]; }
    push(list.map((x) => (x === c ? to : x)), { rename: { from: c, to } }, imgs);
  }
  async function remove(c: string) {
    const n = counts[c] ?? 0;
    if (!(await ask(`ลบหมวด "${c}"?`, { text: n ? `สินค้า ${n} รายการในหมวดนี้จะกลายเป็น "ไม่มีหมวด"` : undefined, ok: 'ลบหมวด', danger: true }))) return;
    const imgs = { ...images }; delete imgs[c];
    push(list.filter((x) => x !== c), { remove: c }, imgs);
  }
  async function setCover(c: string, fl?: File) {
    if (!fl) return;
    setUp(c);
    const r = await uploadImage(fl, 1600);
    setUp('');
    if (!r.ok) { notify(r.error, 'error'); return; }
    if (await push(list, {}, { ...images, [c]: r.data.url })) notify(`ใส่รูปปกหมวด ${c} แล้ว`);
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><div><h2>หมวดหมู่</h2><small className="muted">ลำดับนี้ = ลำดับหมวดบนหน้าร้าน · แตะชื่อเพื่อเปลี่ยนชื่อ</small></div><span className="pill plain">{list.length} หมวด</span></div>
      <div className={css.body}>
        {list.length ? (
          <ul className={css.list}>
            {list.map((c, i) => (
              <li key={c} className={css.row}>
                <div className={css.order}>
                  <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`เลื่อน ${c} ขึ้น`}>▲</button>
                  <button type="button" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)} aria-label={`เลื่อน ${c} ลง`}>▼</button>
                </div>
                {imgReady && (
                  <label className={`${css.cover}${images[c] ? '' : ` ${css.empty}`}`} title="แตะเพื่อใส่ / เปลี่ยนรูปปกหมวด">
                    {images[c] ? <img src={images[c]} alt="" /> : <span>{up === c ? 'กำลังอัป…' : '＋ รูปปก'}</span>}
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy || !!up} onChange={(e) => { setCover(c, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                )}
                <button type="button" className={css.name} disabled={busy} onClick={() => rename(c)} title="แตะเพื่อเปลี่ยนชื่อ">
                  <b>{c}</b><small>{counts[c] ?? 0} สินค้า</small>
                </button>
                <div className={css.acts}>
                  {images[c] && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => { const imgs = { ...images }; delete imgs[c]; push(list, {}, imgs); }}>เอารูปออก</button>}
                  <button type="button" className={css.del} disabled={busy} onClick={() => remove(c)} aria-label={`ลบ ${c}`}>ลบ</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>ยังไม่มีหมวด — เพิ่มหมวดแรกได้เลย เช่น Netflix · Disney+ · YouTube</p>}
        <form onSubmit={add} className={css.add}>
          <input className="input" value={name} maxLength={30} placeholder="ชื่อหมวดใหม่ เช่น Disney+" onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>+ เพิ่มหมวด</button>
        </form>
        {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
        {imgReady ? <ImgHint kind="catCover" /> : <small className="faint">⚠️ รัน SQL <code>0055_category_images.sql</code> เพื่อใส่รูปปกหมวด</small>}
        <small className="faint">รูปปกใช้กับกล่อง &quot;ปุ่มหมวดสินค้า&quot; แบบ <b>รูปปกใหญ่</b> ในหน้าจัดหน้าร้าน</small>
      </div>
    </section>
  );
}
