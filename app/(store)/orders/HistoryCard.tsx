'use client';
import { to } from '@/lib/routes';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { Delivered } from '@/components/Delivered';
import { stripPlain } from '@/lib/fields';
import { DownloadImage } from '@/components/DownloadImage';
import { notify } from '@/components/dialog';
import { ReportDialog } from './ReportDialog';
import { SubCard } from '../my/SubCard';

export type HItem = {
  id: string; name: string; total: number; queued: boolean; delivered: string | null; warranty: string | null;
  usage: string; usageImage: string;
  sub: { id: string; active: boolean; startsAt: string; endsAt: string; productId: string; image: string; template: string } | null;
};
export type HOrder = {
  code: string; status: string; total: number; boughtAt: string; warranty: string | null; expired: boolean;
  items: HItem[]; report: { topic: string; status: string; reply: string; image: string } | null;
};

/** การ์ดออเดอร์ในหน้าประวัติ: เลขออเดอร์ + คัดลอกข้อมูล · วันที่ซื้อ / หมดประกัน / สินค้า · แสดงไอดี · แจ้งปัญหา */
export function HistoryCard({ o, canReport }: { o: HOrder; canReport: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [reporting, setReporting] = useState(false);
  const pending = o.status === 'pending';
  const paid = o.status === 'completed' || o.status === 'processing';
  const waiting = o.items.filter((i) => i.queued).length;
  const ready = o.items.some((i) => i.delivered || i.sub);
  const state = pending ? ['รอชำระเงิน', 'warn'] : o.status === 'cancelled' ? ['ยกเลิกแล้ว', 'muted'] : o.status === 'refunded' ? ['คืนเงินแล้ว', 'muted']
    : waiting === o.items.length ? ['⏳ ร้านกำลังทำให้ — ทำเสร็จแล้วรับของได้ที่นี่', 'warn']
    : waiting > 0 ? [`⏳ ได้รับแล้วบางรายการ · รอร้านทำอีก ${waiting} รายการ`, 'warn']
    : o.expired ? ['หมดอายุแล้ว', 'bad'] : ['ยังไม่หมดอายุ', 'ok'];

  /** คัดลอกไอดีที่ได้ (คลังโค้ด = ข้อความที่ส่ง · แบ่งจอ = ดึงอีเมล / รหัส / โปรไฟล์ / PIN จากเซิร์ฟเวอร์) */
  async function idsText(): Promise<string> {
    const parts: string[] = [];
    for (const i of o.items) {
      let body = stripPlain(i.delivered ?? '');
      if (!body && i.sub) {
        const r = await api<{ login: string; password: string; profile: string; pin: string }>(`/api/my/${i.sub.id}`);
        if (r.ok) body = `อีเมล: ${r.data.login}\nรหัสผ่าน: ${r.data.password}\nโปรไฟล์: ${r.data.profile}${r.data.pin ? `\nPIN: ${r.data.pin}` : ''}`;
      }
      if (body) parts.push(o.items.length > 1 ? `【${i.name}】\n${body}` : body);
    }
    return parts.join('\n\n');
  }
  async function copyAll() {
    const has = o.items.some((i) => i.delivered || i.sub);
    if (!has) { notify(paid ? 'ร้านยังไม่ได้ส่งไอดี' : 'ออเดอร์นี้ยังไม่มีไอดี', 'info'); return; }
    try {
      // Safari (iPhone) ต้องเริ่มคัดลอกทันทีที่กด → ส่ง "สัญญา" ของข้อความให้คลิปบอร์ดก่อน แล้วค่อยดึงข้อมูล
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const text = idsText();
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text.then((t) => { if (!t) throw new Error('empty'); return new Blob([t], { type: 'text/plain' }); }) })]);
      } else {
        const t = await idsText();
        if (!t) throw new Error('empty');
        await navigator.clipboard.writeText(t);
      }
      notify('คัดลอกไอดีแล้ว');
    } catch { notify('คัดลอกไม่ได้ (ไอดีอาจหมดอายุแล้ว) กด "แสดงไอดี" แล้วคัดลอกทีละช่องได้', 'error'); }
  }
  const report = () => setReporting(true);

  return (
    <article className="card hcard">
      <div className="hcard-head">
        <div><small>ออเดอร์</small><b className="num">{o.code}</b></div>
        {ready && <button type="button" className="btn sm hcard-copy" onClick={copyAll}>คัดลอกไอดี</button>}
      </div>
      <dl className="hcard-info">
        <div><dt>วันที่ซื้อสินค้า</dt><dd>{o.boughtAt}</dd></div>
        {o.warranty ? <div><dt>วันหมดประกัน</dt><dd>{o.warranty}</dd></div> : waiting > 0 && <div><dt>วันหมดประกัน</dt><dd className="muted">เริ่มนับเมื่อร้านส่งของ</dd></div>}
        {o.items.map((i) => <div key={i.id}><dt>สินค้า</dt><dd>{i.name} <span className="muted">- {baht(i.total)}</span></dd></div>)}
      </dl>
      <p className={`hcard-state ${state[1]}`}>{state[0]}</p>

      {o.report && (
        <div className={`hcard-report ${o.report.status}`}>
          <b>⚠️ แจ้งปัญหา: {o.report.topic}</b> <span>· {o.report.status === 'resolved' ? 'ร้านแก้ไขแล้ว' : 'รอร้านตอบกลับ'}</span>
          {o.report.image && <a href={o.report.image} target="_blank" rel="noopener noreferrer"><img src={o.report.image} alt="รูปที่แนบ" className="hcard-report-img" /></a>}
          {o.report.reply && <p>💬 ร้านตอบ: {o.report.reply}</p>}
        </div>
      )}

      <div className="hcard-acts">
        {pending ? <Link href={to(`/checkout/${o.code}`)} className="btn primary">ไปจ่ายเงิน</Link>
          : paid && ready && <button type="button" className="btn hcard-show" onClick={() => setShow(!show)}>{show ? 'ซ่อนไอดี' : 'แสดงไอดี'}</button>}
        {paid && canReport && (!o.report || o.report.status === 'resolved') && <button type="button" className="btn hcard-report-btn" onClick={report}>⚠️ แจ้งปัญหา</button>}
      </div>

      {show && (
        <div className="hcard-detail">
          {o.items.map((i) => (
            <div key={i.id} className="hcard-item">
              {o.items.length > 1 && <b>{i.name}</b>}
              {i.sub ? <SubCard s={{ ...i.sub, name: i.name }} />
                : i.delivered ? <Delivered content={i.delivered} warranty={i.warranty} />
                : <p className="muted" style={{ margin: 0 }}>ร้านกำลังดำเนินการ จะแสดงที่นี่เมื่อส่งแล้ว</p>}
              {(i.usage || i.usageImage) && (i.delivered || i.sub) && (
                <details className="usage-box"><summary>📖 วิธีการใช้งาน</summary>
                  {i.usage && <p>{i.usage}</p>}
                  {i.usageImage && <div className="dlv-img"><img src={i.usageImage} alt={`วิธีใช้งาน ${i.name}`} loading="lazy" /><DownloadImage src={i.usageImage} name={`วิธีใช้งาน ${i.name}`} /></div>}
                </details>
              )}
            </div>
          ))}
        </div>
      )}
      {reporting && <ReportDialog code={o.code} onClose={() => setReporting(false)} onSent={() => { setReporting(false); notify('ส่งเรื่องให้ร้านแล้ว ร้านจะตอบกลับในหน้านี้'); router.refresh(); }} />}
    </article>
  );
}
