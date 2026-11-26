'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/components/Cart';

const WORDS = ['', 'ไม่พอใจ', 'พอใช้', 'ดี', 'ดีมาก', 'ประทับใจสุด ๆ'];
const QUICK = ['ส่งไวมาก', 'ใช้งานได้จริง', 'ราคาคุ้ม', 'แอดมินตอบไว', 'จะกลับมาซื้ออีก'];

/** ให้คะแนน + เขียนรีวิวสินค้าที่ได้ของแล้ว (มีรีวิวเดิม = แก้ไข) */
export function ReviewDialog({ item, init, onClose, onSaved }: { item: { id: string; name: string }; init: { stars: number; body: string } | null; onClose: () => void; onSaved: (r: { stars: number; body: string }) => void }) {
  const [stars, setStars] = useState(init?.stars ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(init?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(document.querySelector('.store') ?? document.body), []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [busy, onClose]);

  async function send() {
    if (!stars) { setErr('แตะดาวเพื่อให้คะแนนก่อน'); return; }
    setBusy(true); setErr('');
    const r = await api('/api/reviews', { itemId: item.id, stars, body: text.trim() });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    onSaved({ stars, body: text.trim() });
  }
  const show = hover || stars;

  if (!host) return null;
  return createPortal(
    <div className="rd-bg" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="rd" role="dialog" aria-modal="true" aria-labelledby="rv-title">
        <div className="rd-head">
          <div><h2 id="rv-title">{init ? 'แก้ไขรีวิว' : 'ให้คะแนนสินค้า'}</h2><span className="muted">{item.name.split(' · ')[0]}</span></div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="ปิด">✕</button>
        </div>
        <div className="rd-body">
          <div className="rv-stars" role="radiogroup" aria-label="คะแนน" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ดาว`} className={n <= show ? 'on' : ''}
                onMouseEnter={() => setHover(n)} onClick={() => { setStars(n); setErr(''); }}>★</button>
            ))}
          </div>
          <p className="rv-word">{show ? WORDS[show] : 'แตะดาวเพื่อให้คะแนน'}</p>
          <label className="rd-label" htmlFor="rv-text">เล่าให้คนอื่นฟังหน่อย <span className="muted">(ไม่บังคับ)</span></label>
          <div className="rv-quick">{QUICK.map((q) => <button key={q} type="button" className="chip" onClick={() => setText((t) => (t.includes(q) ? t : `${t}${t ? ' · ' : ''}${q}`).slice(0, 1000))}>+ {q}</button>)}</div>
          <textarea id="rv-text" className="input rd-msg" rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="เช่น ได้รหัสไวมาก ใช้ดูหนังได้ทุกเรื่อง ไม่มีสะดุด" />
          <div className="rd-count muted">{text.length}/1000 · ชื่อของคุณจะถูกปิดบางส่วน</div>
          {err && <p className="rd-err" role="alert">{err}</p>}
        </div>
        <div className="rd-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button type="button" className="btn primary" onClick={send} disabled={busy}>{busy ? 'กำลังส่ง…' : init ? 'บันทึกรีวิว' : 'ส่งรีวิว'}</button>
        </div>
      </div>
    </div>,
    host,
  );
}
