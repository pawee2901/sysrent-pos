'use client';
import { useState } from 'react';

type Call = (payload: object, ok?: string) => Promise<boolean>;
export type OtpAsk = { id: string; account: string; note: string; status: string; extra: number; reply: string; user: string; item: string; code: string; used: number; limit: number; when: string };
export type AckInit = { on: boolean; text: string };

const DEFAULT_TEXT = 'ออเดอร์นี้ขอ OTP ได้ {limit} ครั้ง (เหลือ {left} ครั้ง)\nกด "ส่งรหัส" ในแอปก่อน แล้วค่อยกดค้นหา\nเมื่อได้รหัสแล้วจะนับ 1 ครั้งทันที ครบแล้วจะกดขอไม่ได้อีก';

/** ป๊อปอัปก่อนขอ OTP (เปิด/ปิด · แก้ข้อความ) + คำขอ OTP เพิ่มจากลูกค้า (อนุมัติ / ปฏิเสธ) */
export function AsksTab({ asks, ack, ready, busy, call }: { asks: OtpAsk[]; ack: AckInit; ready: boolean; busy: boolean; call: Call }) {
  const [on, setOn] = useState(ack.on);
  const [text, setText] = useState(ack.text);
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [reply, setReply] = useState<Record<string, string>>({});
  const [show, setShow] = useState<'open' | 'done'>('open');
  const open = asks.filter((a) => a.status === 'open'), done = asks.filter((a) => a.status !== 'open');
  const list = show === 'open' ? open : done;

  if (!ready) return <div className="card card-pad" style={{ color: 'var(--warn)' }}>⚠️ ต้องรัน SQL <code>0051_otp_order_limit.sql</code> และ <code>0052_otp_ack_asks.sql</code> ใน Supabase ก่อน</div>;
  return (
    <>
      <section className="card card-pad" style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, display: 'grid' }}><b>⚠️ ป๊อปอัปก่อนขอ OTP</b>
            <small className="muted">ขึ้นเมื่อออเดอร์ / รหัสตัวแทนจำกัดจำนวนครั้ง · ลูกค้าต้องติ๊ก &quot;เข้าใจแล้ว&quot; ก่อนค้นหา · ปิด = ยังจำกัดจำนวนครั้งเหมือนเดิม แต่ไม่ขึ้นป๊อปอัป</small></div>
          <button type="button" className={`toggle${on ? ' on' : ''}`} aria-label="แสดงป๊อปอัปให้ลูกค้า" onClick={() => setOn(!on)} />
        </div>
        {on && <>
          <label className="field"><span>ข้อความในป๊อปอัป (เว้นว่าง = ข้อความมาตรฐาน · ใส่ <code>{'{limit}'}</code> = จำนวนครั้ง · <code>{'{left}'}</code> = ที่เหลือ)</span>
            <textarea className="input" rows={4} maxLength={1000} value={text} placeholder={DEFAULT_TEXT} onChange={(e) => setText(e.target.value)} /></label>
          {!text && <button type="button" className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={() => setText(DEFAULT_TEXT)}>ใช้ข้อความตัวอย่างแล้วแก้ต่อ</button>}
        </>}
        <button type="button" className="btn primary sm" style={{ justifySelf: 'start' }} disabled={busy || (on === ack.on && text.trim() === ack.text)}
          onClick={() => call({ action: 'ack_config', on, text: text.trim() }, on ? 'บันทึกป๊อปอัปแล้ว' : 'ปิดป๊อปอัปแล้ว')}>บันทึก</button>
      </section>

      <section className="card">
        <div className="card-head"><h2>📝 คำขอ OTP เพิ่ม</h2>
          <nav className="set-tabs" style={{ margin: '0 0 0 auto', borderBottom: 0 }}>
            <button type="button" className={show === 'open' ? 'on' : ''} onClick={() => setShow('open')}>รออนุมัติ <span className={`pill ${open.length ? 'warn' : 'plain'}`}>{open.length}</span></button>
            <button type="button" className={show === 'done' ? 'on' : ''} onClick={() => setShow('done')}>จัดการแล้ว</button>
          </nav></div>
        {!list.length ? <p className="muted card-pad" style={{ margin: 0 }}>{show === 'open' ? 'ไม่มีคำขอรออนุมัติ 👍' : 'ยังไม่มี'} · ลูกค้าที่ขอ OTP ครบแล้วจะกด &quot;ขอรหัส OTP เพิ่ม&quot; ได้</p> : list.map((a) => (
          <div key={a.id} style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <b>{a.item || 'ออเดอร์'}</b>{a.code && <span className="muted">#{a.code}</span>}
              <span className="muted">· {a.user ? `@${a.user}` : 'หน้ารับ OTP'}</span>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 12.5 }}>{a.when}</span>
            </div>
            <small className="muted" style={{ overflowWrap: 'anywhere' }}>📧 {a.account} · ใช้ไป {a.used}{a.limit ? ` / ${a.limit}` : ''} ครั้ง</small>
            <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)', fontSize: 14, whiteSpace: 'pre-wrap' }}>💬 {a.note}</div>
            {a.status === 'open' ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <input className="input" maxLength={500} value={reply[a.id] ?? ''} placeholder="ตอบลูกค้า (ไม่บังคับ)" onChange={(e) => setReply({ ...reply, [a.id]: e.target.value })} />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14 }}>เพิ่มให้</span>
                  <select className="input" style={{ width: 'auto' }} value={extra[a.id] ?? 1} onChange={(e) => setExtra({ ...extra, [a.id]: Number(e.target.value) })}>{[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n} ครั้ง</option>)}</select>
                  <button type="button" className="btn primary sm" disabled={busy} onClick={() => call({ action: 'ask_decide', id: a.id, approve: true, extra: extra[a.id] ?? 1, reply: reply[a.id] ?? '' }, `อนุมัติแล้ว ลูกค้าขอได้อีก ${extra[a.id] ?? 1} ครั้ง`)}>✓ อนุมัติ</button>
                  <button type="button" className="btn ghost sm" disabled={busy} onClick={() => call({ action: 'ask_decide', id: a.id, approve: false, reply: reply[a.id] ?? '' }, 'ปฏิเสธแล้ว')}>ปฏิเสธ</button>
                </div>
              </div>
            ) : <small><span className={`pill ${a.status === 'approved' ? 'ok' : 'plain'}`}>{a.status === 'approved' ? `อนุมัติ +${a.extra} ครั้ง` : 'ปฏิเสธ'}</span>{a.reply && <span className="muted"> · ตอบ: {a.reply}</span>}</small>}
          </div>
        ))}
      </section>
    </>
  );
}
