'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import { AppLogo } from '@/components/AppLogo';
import { OtpAck, type NeedAck } from '@/components/OtpAck';
import { OtpAskBox, type CanAsk } from '@/components/OtpAskBox';
import css from './otpweb.module.css';

type App = { id: string; name: string; image: string; template: string };
type Hit = { code: string | null; link: string | null; subject: string; from?: string; date: string };
const time = (s: string) => new Date(s).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const POLL_MS = 12_000, POLL_MAX = 15; // รอเมล: ดึงเองทุก 12 วินาที นานสุด 3 นาที (ไม่ชนตัวกันกดรัว 6 ครั้ง/นาที)

/**
 * หน้าลูกค้าของเว็บรับ OTP (แบบเว็บเช่า OTP): เลือกแอป → อีเมล (+ รหัสตัวแทน) → รอเมลอัตโนมัติ → รหัสใหญ่ + คัดลอก
 * pinOnly = ระบบตัวแทนใช้รหัส 4 หลักทุกอีเมล → ช่องรหัส 4 ช่อง · ไม่งั้นช่องเดียว (รหัส / ชื่อยูส / อีเมลตัวแทน)
 */
export function OtpWebClient({ name, logo, apps, agent, pinOnly }: { name: string; logo: string; apps: App[]; agent: boolean; pinOnly: boolean }) {
  const [app, setApp] = useState<App | null>(null);
  const [email, setEmail] = useState('');
  const [word, setWord] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [stage, setStage] = useState<'form' | 'wait' | 'done'>('form');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [need, setNeed] = useState<NeedAck | null>(null);
  const [acked, setAcked] = useState(false);
  const [canAsk, setCanAsk] = useState<CanAsk | null>(null);
  const [tries, setTries] = useState(0);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const code = agent ? (pinOnly ? pin.join('') : word.trim()) : '';

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  async function search(ack = acked, attempt = 0) {
    if (!app) return;
    stop(); setBusy(true); setErr(''); setNeed(null); setCanAsk(null);
    const r = await api<{ hits: Hit[] }>('/api/otp/public', { account: email.trim().toLowerCase(), appId: app.id, ...(agent ? { code } : {}), ...(ack ? { ack: true } : {}) });
    setBusy(false);
    const d = r.data as { need_ack?: NeedAck; can_ask?: CanAsk };
    if (r.status === 409 && d.need_ack) { setNeed(d.need_ack); setStage('form'); return; }
    if (!r.ok) { setErr(r.error); setCanAsk(d.can_ask ?? null); setStage('form'); return; }
    if (r.data.hits?.length) { setHits(r.data.hits); setStage('done'); return; }
    // ยังไม่มีเมล → รอแล้วดึงใหม่เอง
    setStage('wait'); setTries(attempt + 1);
    if (attempt + 1 < POLL_MAX) timer.current = setTimeout(() => search(ack, attempt + 1), POLL_MS);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (agent && pinOnly && code.length !== 4) { setErr('กรุณากรอกรหัส 4 หลักให้ครบ'); return; }
    search();
  }
  function setDigit(i: number, v: string) {
    const ds = v.replace(/\D/g, '');
    if (ds.length > 1) { const n = [...pin]; ds.slice(0, 4 - i).split('').forEach((c, k) => { n[i + k] = c; }); setPin(n); pinRefs.current[Math.min(3, i + ds.length)]?.focus(); return; }
    const n = [...pin]; n[i] = ds; setPin(n);
    if (ds && i < 3) pinRefs.current[i + 1]?.focus();
  }
  const copy = (c: string) => navigator.clipboard?.writeText(c).then(() => notify('คัดลอกรหัสแล้ว'), () => {});
  const back = () => { stop(); setStage('form'); setHits([]); setErr(''); };
  const h = hits[0];

  return (
    <div className={css.wrap}>
      <div className={css.head}>
        <div className={css.logoBox}>{logo ? <img src={logo} alt="" /> : <span className={css.ph}>{name.slice(0, 1).toUpperCase()}</span>}<i aria-hidden>✓</i></div>
        <div className={css.shopName}>{name}</div>
        <div className={css.tag}>กดรับ OTP เองได้ ตลอด 24 ชั่วโมง</div>
      </div>

      {!app ? (
        <section>
          <h2 className={css.h2}>เลือกแอปที่ต้องการรับรหัส</h2>
          {apps.length ? <div className={css.grid}>{apps.map((a) => (
            <button key={a.id} type="button" className={css.appCard} onClick={() => { setApp(a); setErr(''); }}>
              <span className={css.ic}><AppLogo image={a.image} template={a.template} name={a.name} size="xl" /></span><b>{a.name}</b>
            </button>))}</div> : <p className={css.empty}>ร้านนี้ยังไม่ได้เปิดบริการ</p>}
        </section>
      ) : stage === 'form' ? (
        <form className={css.card} onSubmit={submit}>
          <div className={css.bar}><button type="button" className={css.back} onClick={() => { setApp(null); setErr(''); }}>← ย้อนกลับ</button><span className={css.apTag}>{app.name}</span></div>
          <div className={css.center}><h3>ค้นหารหัสยืนยัน</h3>
            <p>{agent ? (pinOnly ? 'กรอกอีเมล และรหัส 4 หลักที่ได้รับจากแอดมิน' : 'กรอกอีเมล และรหัส / ชื่อยูส / อีเมล ที่ได้รับจากแอดมิน') : 'ใส่อีเมลบัญชีของคุณ เพื่อดึงรหัสยืนยันล่าสุดได้ทันที'}</p></div>
          <label className={css.inp}><span aria-hidden>✉️</span>
            <input type="email" required value={email} autoComplete="email" inputMode="email" placeholder="กรอกอีเมลของคุณ เช่น example@gmail.com" onChange={(e) => setEmail(e.target.value)} /></label>
          {agent && (pinOnly ? (
            <div className={css.pinWrap}>
              <div className={css.pinRow}>{pin.map((d, i) => (
                <input key={i} ref={(el) => { pinRefs.current[i] = el; }} className={`${css.pinBox}${d ? ` ${css.filled}` : ''}`} inputMode="numeric" autoComplete="off" maxLength={4}
                  type={showPin ? 'text' : 'password'} value={d} aria-label={`รหัสหลักที่ ${i + 1}`}
                  onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) pinRefs.current[i - 1]?.focus(); }} />))}</div>
              <button type="button" className={css.eye} onClick={() => setShowPin(!showPin)}>{showPin ? '🙈 ซ่อนรหัส' : '👁 แสดงรหัส'}</button>
            </div>
          ) : (
            <label className={css.inp}><span aria-hidden>🔑</span>
              <input required value={word} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={120} placeholder="รหัส / ชื่อยูส / อีเมล ที่ได้รับจากแอดมิน" onChange={(e) => setWord(e.target.value)} /></label>
          ))}
          <button type="submit" className={css.go} disabled={busy}>{busy ? 'กำลังค้นหา…' : 'ขอรหัส OTP'}</button>
          {err && <div className={css.err} role="alert"><b>เกิดข้อผิดพลาด</b><br />{err}</div>}
          {canAsk && <OtpAskBox ask={canAsk} account={email.trim().toLowerCase()} />}
        </form>
      ) : (
        <section className={css.card}>
          <div className={css.bar}><button type="button" className={css.back} onClick={back}>← ย้อนกลับ</button><span className={css.who}>{email}</span></div>
          {stage === 'wait' ? (
            <div className={css.wait}>
              <span className={css.spin} aria-hidden />
              <p className={css.t1}>⏳ กำลังรอรับข้อความ OTP ล่าสุด…</p>
              <p className={css.t2}>{tries < POLL_MAX ? <>ระบบดึงอีเมลให้อัตโนมัติ (ครั้งที่ {tries} / {POLL_MAX})<br />กรุณากด &quot;ส่งรหัส&quot; ในแอป {app.name} ก่อน</> : 'ยังไม่พบรหัสใน 15 นาทีล่าสุด'}</p>
              <button type="button" className={css.again} disabled={busy} onClick={() => search(acked, 0)}>{busy ? 'กำลังค้นหา…' : '🔄 ค้นหาอีกครั้ง'}</button>
            </div>
          ) : h && (
            <div className={css.result}>
              <div className={css.otp}>
                <span className={css.lb}>{h.code ? 'รหัสยืนยันตัวตน (OTP)' : 'ลิงก์ยืนยัน'} · ได้รับ {time(h.date)} น.</span>
                {h.code ? <button type="button" className={css.num} onClick={() => copy(h.code!)} aria-label={`คัดลอกรหัส ${h.code}`}>{h.code}</button>
                  : h.link && <a className={css.go} href={h.link} target="_blank" rel="noopener noreferrer">เปิดลิงก์ยืนยัน</a>}
                {h.code && <button type="button" className={css.go} onClick={() => copy(h.code!)}>📋 คัดลอกรหัส OTP</button>}
                <small>⏱️ รหัสมีอายุประมาณ 15 นาที หมดเวลาให้ขอรหัสใหม่ในแอปแล้วกดค้นหาอีกครั้ง</small>
              </div>
              {hits.length > 1 && <details className={css.more}><summary>เมลอื่น ๆ ({hits.length - 1})</summary>
                {hits.slice(1).map((x, i) => <div key={i} className={css.mail}><b>{x.code ?? '—'}</b><small>{x.subject || '(ไม่มีหัวข้อ)'} · {time(x.date)} น.</small></div>)}</details>}
              <button type="button" className={css.again} disabled={busy} onClick={() => search(acked, 0)}>🔄 ค้นหาอีกครั้ง</button>
            </div>
          )}
        </section>
      )}
      {need && <OtpAck need={need} onCancel={() => setNeed(null)} onOk={() => { setAcked(true); search(true); }} />}
    </div>
  );
}
