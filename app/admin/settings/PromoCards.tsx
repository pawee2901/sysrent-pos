'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';

export type Promo = { image: string; link: string };
export const PROMO_MAX = 8;

/** กล่องรูปโปรโมทใต้รูปหน้าแรก (ไม่ใส่ = ไม่แสดง) · แต่ละกล่องมีรูป + ลิงก์ (ไม่บังคับ) */
export function PromoCards({ init }: { init: { ready: boolean; cards: Promo[] } }) {
  const router = useRouter();
  const [cards, setCards] = useState<Promo[]>(init.cards);
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const set = (i: number, patch: Partial<Promo>) => setCards(cards.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const move = (i: number) => { const a = [...cards]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setCards(a); };

  async function add(files: File[]) {
    setBusy(true);
    const got: Promo[] = [];
    for (const fl of files) {
      const fd = new FormData(); fd.append('file', fl);
      const r = await api<{ url: string }>('/api/admin/upload', fd);
      if (r.ok) got.push({ image: r.data.url, link: '' }); else { notify(r.error, 'error'); break; }
    }
    setBusy(false);
    if (got.length) setCards((c) => [...c, ...got]);
  }
  async function save() {
    setBusy(true);
    const r = await api('/api/admin/settings', { action: 'promos', cards: cards.map((c) => ({ image: c.image, link: c.link.trim() })) });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify(cards.length ? 'บันทึกกล่องรูปแล้ว ✓' : 'เอากล่องรูปออกจากหน้าแรกแล้ว ✓'); router.refresh();
  }

  return (
    <section className="card">
      <div className="card-head"><h2>กล่องรูปใต้รูปหน้าแรก</h2><span className={`pill ${cards.length ? 'ok' : 'plain'}`}>{cards.length ? `${cards.length} กล่อง` : 'ไม่แสดง'}</span></div>
      <div className="form">
        {!init.ready && <p style={{ color: 'var(--warn)', margin: 0 }}>⚠️ ต้องรัน SQL <code>0031_shop_promo_cards.sql</code> ใน Supabase ก่อน</p>}
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>ใส่หรือไม่ใส่ก็ได้ · เช่น สมัครตัวแทน · โปรเด็ด · ประวัติการสั่งซื้อ · แจ้งปัญหา · แนะนำรูปแนวนอน 2:1 (เช่น 800×400) ขนาดเท่ากันทุกกล่อง</p>
        {cards.length > 0 && (
          <div className="promo-ed">
            {cards.map((c, i) => (
              <div key={`${c.image}${i}`} className="promo-ed-item">
                <div className="promo-ed-img">
                  <img src={c.image} alt={`กล่องที่ ${i + 1}`} />
                  <button type="button" className="imgs-x" aria-label={`ลบกล่องที่ ${i + 1}`} onClick={() => setCards(cards.filter((_, k) => k !== i))}>✕</button>
                  {i > 0 && <button type="button" className="imgs-left" aria-label={`เลื่อนกล่องที่ ${i + 1} ไปก่อน`} onClick={() => move(i)}>‹</button>}
                </div>
                <input className="input" value={c.link} maxLength={300} placeholder="กดแล้วไปที่ (ไม่บังคับ) เช่น /history หรือ https://..." aria-label={`ลิงก์กล่องที่ ${i + 1}`} onChange={(e) => set(i, { link: e.target.value })} />
              </div>
            ))}
          </div>
        )}
        <input ref={pick} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { const fl = [...(e.target.files ?? [])].slice(0, PROMO_MAX - cards.length); e.target.value = ''; if (fl.length) add(fl); }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cards.length < PROMO_MAX && <button type="button" className="btn" disabled={busy || !init.ready} onClick={() => pick.current?.click()}>＋ เพิ่มกล่องรูป</button>}
          <button type="button" className="btn primary" disabled={busy || !init.ready} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึกกล่องรูป'}</button>
        </div>
        <small className="faint" style={{ fontSize: 12 }}>ลิงก์ในร้านใช้ / นำหน้า เช่น /history (ประวัติการซื้อ) · ลิงก์นอกร้านใช้ https:// · ใส่ได้สูงสุด {PROMO_MAX} กล่อง</small>
      </div>
    </section>
  );
}
