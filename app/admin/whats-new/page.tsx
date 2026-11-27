import Link from 'next/link';
import { adminShop } from '@/lib/admin-page';
import { NEWS } from '@/lib/whats-new';
import { to } from '@/lib/routes';
import { SeenNews } from './SeenNews';
import css from '../guide/guide.module.css';

/** หลังบ้าน → มีอะไรใหม่ (แอดมินทุกคนดูได้) */
export default async function WhatsNew() {
  if (!(await adminShop())) return null;
  const fmt = (d: string) => new Date(`${d}T12:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const days = [...new Set(NEWS.map((n) => n.date))];
  return (
    <>
      <SeenNews />
      <div className="page-head"><div><h1>✨ มีอะไรใหม่</h1><p>ฟีเจอร์ใหม่และสิ่งที่ปรับปรุงในหลังบ้าน</p></div></div>
      <div className={css.timeline}>
        {days.map((d) => (
          <section key={d} className={css.day}>
            <h2 className={css.date}>{fmt(d)}</h2>
            {NEWS.filter((n) => n.date === d).map((n) => (
              <article key={n.id} className={`card ${css.news}`}>
                <span className={`${css.tag} ${n.tag === 'ใหม่' ? css.tNew : n.tag === 'ราคา' ? css.tPrice : css.tFix}`}>{n.tag}</span>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                {n.points && <ol>{n.points.map((p) => <li key={p}>{p}</li>)}</ol>}
                {n.href && <Link href={to(`/admin${n.href}`)} className="btn sm">ไปดูเลย ›</Link>}
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
