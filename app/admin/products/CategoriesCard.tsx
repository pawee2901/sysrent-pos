'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ask, input } from '@/components/dialog';
import { api } from '@/components/Cart';

/** จัดการหมวดหมู่: เพิ่ม · เปลี่ยนชื่อ · เลื่อนลำดับ · ลบ (ลำดับนี้ = ลำดับปุ่มหมวดบนหน้าร้าน) */
export function CategoriesCard({ categories, counts }: { categories: string[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [list, setList] = useState(categories);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function push(next: string[], extra: { rename?: { from: string; to: string }; remove?: string } = {}) {
    setBusy(true); setErr('');
    const r = await api('/api/admin/categories', { list: next, ...extra });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setList(next); router.refresh();
  }
  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (list.includes(n)) { setErr('มีหมวดนี้อยู่แล้ว'); return; }
    push([...list, n]).then(() => setName(''));
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
    push(list.map((x) => (x === c ? to : x)), { rename: { from: c, to } });
  }
  async function remove(c: string) {
    const n = counts[c] ?? 0;
    if (!(await ask(`ลบหมวด "${c}"?`, { text: n ? `สินค้า ${n} รายการในหมวดนี้จะกลายเป็น "ไม่มีหมวด"` : undefined, ok: 'ลบหมวด', danger: true }))) return;
    push(list.filter((x) => x !== c), { remove: c });
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><h2>หมวดหมู่</h2><span className="muted" style={{ fontSize: 13 }}>ลำดับนี้ = ลำดับปุ่มหมวดบนหน้าร้าน</span></div>
      <div className="card-pad" style={{ display: 'grid', gap: 12 }}>
        {list.length ? (
          <div className="cats">
            {list.map((c, i) => (
              <div key={c} className="cat">
                <button type="button" className="cat-mv" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`เลื่อน ${c} ขึ้น`}>‹</button>
                <button type="button" className="cat-name" disabled={busy} onClick={() => rename(c)} title="กดเพื่อเปลี่ยนชื่อ">{c}<small>{counts[c] ?? 0}</small></button>
                <button type="button" className="cat-mv" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)} aria-label={`เลื่อน ${c} ลง`}>›</button>
                <button type="button" className="cat-x" disabled={busy} onClick={() => remove(c)} aria-label={`ลบ ${c}`}>✕</button>
              </div>
            ))}
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>ยังไม่มีหมวด — เพิ่มหมวดแรกได้เลย เช่น ดูหนัง · เพลง · อนิเมะ</p>}
        <form onSubmit={add} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={name} maxLength={30} placeholder="ชื่อหมวดใหม่ เช่น อนิเมะ" onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>+ เพิ่มหมวด</button>
        </form>
        {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
        <small className="faint">กดชื่อหมวดเพื่อเปลี่ยนชื่อ (สินค้าในหมวดย้ายตามให้เอง) · ‹ › เลื่อนลำดับ · ตัวเลข = จำนวนสินค้าในหมวด</small>
      </div>
    </section>
  );
}
