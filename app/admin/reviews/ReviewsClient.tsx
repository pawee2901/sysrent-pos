'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { to } from '@/lib/routes';
import { api } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';

export type AdminReview = { id: string; stars: number; body: string; reply: string; hidden: boolean; user: string; product: string; code: string; when: string };
const TABS: [string, string][] = [['', 'ทั้งหมด'], ['5', '5★'], ['4', '4★'], ['3', '3★'], ['2', '2★'], ['1', '1★'], ['hidden', 'ซ่อนอยู่']];

/** รีวิวจากผู้ซื้อ: ดู · ซ่อนจากหน้าร้าน · ตอบกลับ (แสดงใต้รีวิว) · ลบ */
export function ReviewsClient({ list, ready, filter }: { list: AdminReview[]; ready: boolean; filter: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [replying, setReplying] = useState<{ id: string; text: string } | null>(null);
  const avg = list.length ? (list.reduce((s, r) => s + r.stars, 0) / list.length).toFixed(1) : '–';

  async function run(id: string, payload: Record<string, unknown>, done: string) {
    setBusy(id);
    const r = await api('/api/admin/reviews', { id, ...payload });
    setBusy('');
    if (!r.ok) { notify(r.error, 'error'); return false; }
    notify(done); router.refresh(); return true;
  }

  return (
    <>
      <div className="page-head"><div><h1>รีวิว</h1><p>รีวิวจากผู้ซื้อจริง · แสดงที่หน้าสินค้า และกล่อง &quot;รีวิวจากผู้ซื้อจริง&quot; ในหน้าจัดร้าน</p></div></div>
      {!ready && <div className="card card-pad" style={{ color: 'var(--warn)' }}>⚠️ ต้องรัน SQL <code>0042_reviews.sql</code> ใน Supabase ก่อน ลูกค้าถึงจะรีวิวได้</div>}
      <nav className="set-tabs" aria-label="กรองรีวิว">{TABS.map(([k, l]) => <Link key={k} href={`${to('/admin/reviews')}${k ? `?s=${k}` : ''}`} className={filter === k ? 'on' : ''} style={{ padding: '8px 14px', borderRadius: 10 }}>{l}</Link>)}</nav>
      <section className="card">
        <div className="card-head"><h2>{list.length} รีวิว</h2>{list.length > 0 && <span className="pill accent plain">เฉลี่ย ★ {avg}</span>}</div>
        {!list.length ? <div className="card-pad"><p className="muted" style={{ margin: 0 }}>ยังไม่มีรีวิว · ลูกค้ารีวิวได้ที่หน้าประวัติการซื้อหลังได้ของ</p></div> : (
          <div className="arv-list">{list.map((r) => (
            <article key={r.id} className={`arv${r.hidden ? ' off' : ''}`}>
              <div className="arv-top">
                <span className="arv-st">{'★'.repeat(r.stars)}<i>{'★'.repeat(5 - r.stars)}</i></span>
                <b>@{r.user}</b><span className="muted">· {r.product.split(' · ')[0]}{r.code && ` · #${r.code}`} · {r.when}</span>
                {r.hidden && <span className="pill warn">ซ่อนอยู่</span>}
              </div>
              {r.body ? <p className="arv-body">{r.body}</p> : <p className="arv-body muted">(ให้ดาวอย่างเดียว)</p>}
              {replying?.id === r.id ? (
                <div className="arv-reply-ed">
                  <textarea className="input" rows={2} maxLength={1000} autoFocus value={replying.text} placeholder="เช่น ขอบคุณที่อุดหนุนครับ 🙏" onChange={(e) => setReplying({ id: r.id, text: e.target.value })} />
                  <div className="lb-row"><button type="button" className="btn primary sm" disabled={busy === r.id} onClick={async () => { if (await run(r.id, { action: 'reply', reply: replying.text }, replying.text.trim() ? 'ตอบรีวิวแล้ว ✓' : 'ลบคำตอบแล้ว')) setReplying(null); }}>บันทึกคำตอบ</button>
                    <button type="button" className="btn ghost sm" onClick={() => setReplying(null)}>ยกเลิก</button></div>
                </div>
              ) : r.reply && <div className="arv-reply"><b>💬 ร้านตอบ</b> {r.reply}</div>}
              <div className="arv-acts">
                <button type="button" className="btn sm" onClick={() => setReplying({ id: r.id, text: r.reply })}>💬 {r.reply ? 'แก้คำตอบ' : 'ตอบกลับ'}</button>
                <button type="button" className="btn sm" disabled={busy === r.id} onClick={() => run(r.id, { action: 'hide', hidden: !r.hidden }, r.hidden ? 'แสดงรีวิวแล้ว' : 'ซ่อนรีวิวจากหน้าร้านแล้ว')}>{r.hidden ? '👁 แสดง' : '🙈 ซ่อน'}</button>
                <button type="button" className="btn ghost sm" disabled={busy === r.id} onClick={async () => { if (await ask('ลบรีวิวนี้?', { text: 'ลูกค้าจะรีวิวรายการนี้ใหม่ได้', ok: 'ลบ', danger: true })) run(r.id, { action: 'delete' }, 'ลบรีวิวแล้ว'); }}>ลบ</button>
              </div>
            </article>))}</div>
        )}
      </section>
    </>
  );
}
