'use client';
import { useState } from 'react';
import { ask } from '@/components/dialog';
import { ACCESS_KINDS, ACCESS_LABEL, PERIODS, PERIOD_LABEL, type AccessKind, type OtpAccess, type Period } from '@/lib/otp-agent';

type Call = (payload: object, ok?: string) => Promise<boolean>;
export type AgentInit = { ready: boolean; on: boolean; list: OtpAccess[] };

const randPin = () => String(Math.floor(1000 + Math.random() * 9000));
const blank = { email: '', label: '', kind: 'pin' as AccessKind, secret: randPin(), use_limit: '0', period: 'day' as Period };

/**
 * ระบบตัวแทน (แบบเว็บเช่า OTP): ร้านตั้งรหัสยืนยันให้แต่ละอีเมล
 * ลูกค้า / ตัวแทน กรอกอีเมล + รหัส ที่หน้ารับ OTP · หลายรหัสต่ออีเมล = แยกจอ (โควตาแยกกัน)
 */
export function AgentTab({ agent, openPage, busy, call }: { agent: AgentInit; openPage: boolean; busy: boolean; call: Call }) {
  const [f, setF] = useState(blank);
  const [q, setQ] = useState('');
  const groups = [...new Set(agent.list.map((a) => a.email))].filter((e) => !q.trim() || e.includes(q.trim().toLowerCase()));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call({ action: 'access_add', email: f.email, label: f.label, kind: f.kind, secret: f.secret, use_limit: Number(f.use_limit) || 0, period: f.period }, 'เพิ่มรหัสแล้ว')) {
      setF({ ...blank, email: f.email, kind: f.kind, use_limit: f.use_limit, period: f.period, secret: f.kind === 'pin' ? randPin() : '' });
    }
  }

  if (!agent.ready) return <div className="card card-pad" style={{ color: 'var(--warn)' }}>⚠️ ต้องรัน SQL <code>0048_otp_public_page.sql</code> และ <code>0049_otp_agent.sql</code> ใน Supabase ก่อน</div>;
  return (
    <>
      <section className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
          <span style={{ flex: 'none', width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', fontSize: 20 }}>🤝</span>
          <div style={{ flex: 1, minWidth: 0, display: 'grid' }}><b>ระบบตัวแทน</b>
            <small className="muted">{agent.on ? 'เปิดอยู่ · ที่หน้ารับ OTP ต้องกรอกอีเมล + รหัสที่ร้านให้ ถึงจะได้รหัส' : 'ปิดอยู่ · หน้ารับ OTP ค้นได้ด้วยอีเมลอย่างเดียว (เฉพาะอีเมลในสินค้าที่ยังไม่หมดอายุ)'}</small>
            {!openPage && <small style={{ color: 'var(--warn)' }}>ต้องเลือก &quot;💬 หน้ารับ OTP&quot; ในการ์ด ลูกค้าค้นหา OTP ที่ไหน ด้านบนก่อน ลูกค้าถึงจะใช้ได้</small>}</div>
          <button type="button" className={`toggle${agent.on ? ' on' : ''}`} aria-label="เปิด / ปิดระบบตัวแทน" disabled={busy}
            onClick={() => call({ action: 'agent_mode', on: !agent.on }, agent.on ? 'ปิดระบบตัวแทนแล้ว' : 'เปิดระบบตัวแทนแล้ว')} />
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>เพิ่มรหัสให้อีเมล</h2></div>
        <form className="form" onSubmit={add}>
          <div className="two">
            <label className="field"><span>อีเมลบัญชี (ที่ใช้รับ OTP)</span><input className="input" type="email" required maxLength={120} value={f.email} placeholder="เช่น netflix01@gmail.com" onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label className="field"><span>ชื่อจอ / ชื่อลูกค้า (ไม่บังคับ)</span><input className="input" maxLength={40} value={f.label} placeholder="เช่น จอ 1 · ตัวแทน A" onChange={(e) => setF({ ...f, label: e.target.value })} /></label>
          </div>
          <div className="field"><span>ลูกค้ายืนยันด้วย</span>
            <div className="set-tabs" role="radiogroup" style={{ marginBottom: 0 }}>{ACCESS_KINDS.map((k) => <button key={k} type="button" role="radio" aria-checked={f.kind === k} className={f.kind === k ? 'on' : ''} onClick={() => setF({ ...f, kind: k, secret: k === 'pin' ? randPin() : '' })}>{ACCESS_LABEL[k]}</button>)}</div></div>
          <div className="two">
            <label className="field"><span>{ACCESS_LABEL[f.kind]}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" required value={f.secret} maxLength={f.kind === 'pin' ? 4 : 120} inputMode={f.kind === 'pin' ? 'numeric' : undefined}
                  placeholder={f.kind === 'pin' ? '4 หลัก' : f.kind === 'email' ? 'อีเมลของตัวแทน' : 'ชื่อยูสของตัวแทน'} onChange={(e) => setF({ ...f, secret: f.kind === 'pin' ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value })} />
                {f.kind === 'pin' && <button type="button" className="btn sm" title="สุ่มรหัสใหม่" onClick={() => setF({ ...f, secret: randPin() })}>🎲</button>}
              </div></label>
            <div className="field"><span>รับรหัสได้ (0 = ไม่จำกัด)</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="input" inputMode="numeric" style={{ width: 80 }} value={f.use_limit} onChange={(e) => setF({ ...f, use_limit: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                <span className="muted">ครั้ง / </span>
                <select className="input" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value as Period })}>{PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}</select>
              </div></div>
          </div>
          <small className="faint">อีเมลเดียวกันเพิ่มได้หลายรหัส = แยกจอ / แยกตัวแทน แต่ละรหัสมีโควตาของตัวเอง ปิดหรือลบรหัสเดียวได้โดยไม่กระทบคนอื่น</small>
          <button type="submit" className="btn primary" disabled={busy}>+ เพิ่มรหัส</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head"><h2>รหัสทั้งหมด</h2><span className="pill plain">{agent.list.length}</span>
          {agent.list.length > 5 && <input className="input" style={{ maxWidth: 220, marginLeft: 'auto' }} value={q} placeholder="🔍 ค้นหาอีเมล" onChange={(e) => setQ(e.target.value)} />}</div>
        {!agent.list.length ? <p className="muted card-pad" style={{ margin: 0 }}>ยังไม่มีรหัส · เพิ่มด้านบน</p> : groups.map((email) => (
          <div key={email} style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', display: 'grid', gap: 8 }}>
            <b style={{ overflowWrap: 'anywhere' }}>📧 {email}</b>
            {agent.list.filter((a) => a.email === email).map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 12, background: 'var(--surface-2)', opacity: a.active ? 1 : .55 }}>
                <span style={{ flex: '1 1 200px', minWidth: 0, display: 'grid' }}>
                  <span><span className="pill accent plain">{ACCESS_LABEL[a.kind]}</span> <code style={{ fontSize: 14, fontWeight: 700 }}>{a.secret}</code>{a.label && <span className="muted"> · {a.label}</span>}</span>
                  <small className="muted">{a.use_limit ? `ใช้ไป ${a.used ?? 0} / ${a.use_limit} ครั้งต่อ${PERIOD_LABEL[a.period]}` : `ไม่จำกัด · ใช้ไป ${a.used ?? 0} ครั้งใน 1 ${PERIOD_LABEL[a.period]}`}</small>
                </span>
                <button type="button" className={`toggle${a.active ? ' on' : ''}`} aria-label="เปิด / ปิดรหัสนี้" disabled={busy} onClick={() => call({ action: 'access_update', id: a.id, active: !a.active }, a.active ? 'ปิดรหัสนี้แล้ว' : 'เปิดรหัสนี้แล้ว')} />
                <button type="button" className="btn ghost sm" disabled={busy} onClick={async () => { if (await ask(`ลบรหัส ${a.secret} ของ ${a.email}?`, { ok: 'ลบ', danger: true })) call({ action: 'access_delete', id: a.id }, 'ลบแล้ว'); }}>ลบ</button>
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
