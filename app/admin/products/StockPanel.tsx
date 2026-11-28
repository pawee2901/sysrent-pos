'use client';
import { useMemo, useState } from 'react';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import { Delivered } from '@/components/Delivered';
import { markPlain } from '@/lib/fields';
import { FormBuilder, renderForm, type DForm } from './DeliveryForm';
import { StockList, type MoveTarget } from './StockList';
import css from './dform.module.css';

/**
 * เติมสต็อก (แบบง่าย): เลือกว่าลูกค้าได้ของไม่ซ้ำ / เหมือนกันทุกคน → วางข้อมูลช่องเดียว → เพิ่ม
 * ตัวเลือกเสริม (แบบฟอร์มร้าน · ปุ่มรับ OTP) พับไว้ เปิดเมื่ออยากใช้
 */
type Split = 'line' | 'blank';
type Otp = { ready: boolean; apps: { id: string; name: string }[] } | null;
const EMAIL = /[^\s|:：,;]+@[^\s|:：,;]+\.[a-z]{2,}/i;
const clean = (s: string) => s.replace(/\r\n/g, '\n');
const noSep = (s: string) => s.replace(/^\s*-{3,}\s*$/gm, '───────');

export function StockPanel({ productId, option, left, form, onForm, otp, otpApp, setOtpApp, savedOtpApp, onAdded, targets = [], otpLimit = 0 }: {
  productId: string; option: { id: string; name: string; days: string }; left: number;
  form: DForm | null; onForm: (f: DForm | null) => void;
  otp: Otp; otpApp: string; setOtpApp: (v: string) => void; savedOtpApp: string;
  onAdded: (notice: string) => void; targets?: MoveTarget[]; otpLimit?: number;
}) {
  const [lim, setLim] = useState(String(otpLimit));
  const [tab, setTab] = useState<'add' | 'list'>('add');
  const [shared, setShared] = useState(false);
  const [split, setSplit] = useState<Split>('line');
  const [text, setText] = useState('');
  const [rep, setRep] = useState('1');
  const [building, setBuilding] = useState(false);
  const [more, setMore] = useState<'' | 'form' | 'otp'>('');
  const [otpAll, setOtpAll] = useState('');
  const [busy, setBusy] = useState(false);
  const useFormNow = !!form && !shared;

  /** ข้อความ → รายการชิ้น (ข้อความที่ลูกค้าจะได้จริง) */
  const items = useMemo(() => {
    const t = clean(text).trim();
    if (!t) return [] as string[];
    if (shared) return [noSep(t)];
    if (useFormNow) return t.split('\n').filter((l) => l.trim()).map((l) => renderForm(form!, l.split(/\t|\s*\|\s*/)).replace(/^\n+|\s+$/g, ''));
    if (split === 'blank') return t.split(/\n\s*\n/).map((x) => noSep(x.replace(/^\n+|\s+$/g, ''))).filter((x) => x.trim());
    return t.split('\n').map((l) => l.trim()).filter((l) => l && !/^-{3,}$/.test(l));
  }, [text, shared, split, useFormNow, form]);
  const n = Math.min(500, Math.max(1, Number(rep) || 1));
  // ข้อความทั้งก้อน / ฟอร์ม = แสดงทั้งก้อน · 1 บรรทัด = ให้ระบบแยกช่อง (อีเมล | รหัส) ให้
  const plain = shared || useFormNow || split === 'blank';
  const preview = items[0] ? (plain ? markPlain(items[0]) : items[0]) : '';

  async function add() {
    if (!items.length) return;
    setBusy(true);
    if (otp?.ready && otpApp !== savedOtpApp) {
      const o = await api('/api/admin/products', { action: 'otp', id: productId, app_id: otpApp || null });
      if (!o.ok) { setBusy(false); notify(o.error, 'error'); return; }
    }
    // เมลรับ OTP: ใส่เมลเดียวไว้ = ทุกชิ้นใช้เมลนั้น · ไม่ใส่ = ใช้อีเมลที่อยู่ในแต่ละชิ้นเอง
    const mails = otpApp ? (otpAll.trim() ? { otp_email: otpAll.trim() } : { otp_emails: items.map((c) => EMAIL.exec(c)?.[0] ?? '') }) : {};
    const r = await api<{ notice: string }>('/api/admin/products', { action: 'stock', optionId: option.id, text: items.join('\n---\n'), mode: 'block', plain, repeat: n, ...mails });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    setText(''); onAdded(r.data.notice);
  }

  async function saveForm(fm: DForm | null) {
    setBusy(true);
    const r = await api('/api/admin/products', { action: 'form', optionId: option.id, form: fm });
    setBusy(false);
    if (!r.ok) notify(/0046/.test(r.error) ? 'ใช้แบบฟอร์มได้เลย แต่ระบบยังจำไว้ไม่ได้ (ต้องรัน SQL 0046_delivery_form.sql)' : r.error, 'info');
    else notify(fm ? 'บันทึกแบบฟอร์มแล้ว ✓' : 'เลิกใช้แบบฟอร์มแล้ว');
    onForm(fm); setBuilding(false); setText('');
  }

  if (building) return <FormBuilder initial={form} busy={busy} onSave={saveForm} onCancel={() => setBuilding(false)} />;

  return (
    <div className={css.panel}>
      <div className={css.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'add'} className={tab === 'add' ? css.on : ''} onClick={() => setTab('add')}>➕ เติมสต็อก</button>
        <button type="button" role="tab" aria-selected={tab === 'list'} className={tab === 'list' ? css.on : ''} onClick={() => setTab('list')}>📦 ในสต็อก <b>{left}</b></button>
      </div>

      {tab === 'list' ? <StockList optionId={option.id} targets={targets} onChanged={() => onAdded('')} /> : <>
        {/* ตั้งค่าไว้บนสุด: ปุ่มรับ OTP · แบบฟอร์มร้าน */}
        {otp && (
          <div className={css.extra}>
            <button type="button" className={css.exHead} aria-expanded={more === 'otp'} onClick={() => setMore(more === 'otp' ? '' : 'otp')}>
              <span>🔐</span><span><b>ปุ่มรับ OTP</b><small>{otpApp ? `เปิด · ${otp.apps.find((a) => a.id === otpApp)?.name ?? ''}` : 'ปิดอยู่ · ลูกค้ากดรับรหัสเองได้'}{otpLimit ? ` · ${otpLimit} ครั้ง/ออเดอร์` : ''}</small></span><i>{more === 'otp' ? '−' : '+'}</i></button>
            {more === 'otp' && (
              <div className={css.exBody}>
                <select className="input" value={otpApp} disabled={!otp.ready || !otp.apps.length} onChange={(e) => setOtpApp(e.target.value)}>
                <option value="">ปิด — ไม่แสดงปุ่ม</option>
                {otp.apps.map((a) => <option key={a.id} value={a.id}>เปิด — ค้นรหัสของ {a.name}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14 }}>1 ออเดอร์ขอ OTP ได้</span>
                  <input className="input" inputMode="numeric" style={{ width: 64, textAlign: 'center' }} value={lim} aria-label="จำนวนครั้งต่อออเดอร์" onChange={(e) => setLim(e.target.value.replace(/\D/g, '').slice(0, 3))} />
                  <span style={{ fontSize: 14 }}>ครั้ง</span>
                  <button type="button" className="btn sm" disabled={busy || Number(lim || 0) === otpLimit} onClick={async () => {
                    const n = Math.min(100, Number(lim || 0));
                    const r = await api('/api/admin/products', { action: 'otp_limit', optionId: option.id, limit: n });
                    if (!r.ok) { notify(r.error, 'error'); return; }
                    notify(n ? `ออเดอร์แพ็กเกจนี้ขอ OTP ได้ ${n} ครั้ง` : 'ไม่จำกัดจำนวนครั้งแล้ว'); onAdded('');
                  }}>บันทึก</button>
                </div>
                <small className="faint">{Number(lim || 0) ? `ลูกค้าต้องติ๊กยอมรับก่อนค้นหา · ครบ ${Number(lim)} ครั้งแล้วขอไม่ได้อีก` : '0 = ไม่จำกัด (ใช้กับแพ็กเกจนี้ ทั้งหน้าค้นหา OTP และปุ่มในประวัติการซื้อ)'}</small>
                {otpApp && <input className="input" type="email" value={otpAll} onChange={(e) => setOtpAll(e.target.value)} placeholder="เมลรับ OTP (เว้นว่าง = ใช้อีเมลในแต่ละชิ้น)" />}
                <small className="faint">{!otp.ready ? '⚠️ ต้องรัน SQL 0032_product_otp_button.sql ก่อน' : !otp.apps.length ? 'เพิ่มแอปในหน้า "ค้นหา OTP" ก่อน' : 'ลูกค้าที่ได้ชิ้นนั้นจะเห็นปุ่มรับรหัสในหน้าประวัติการซื้อ'}</small>
              </div>
            )}
          </div>
        )}
        {!shared && (
          <div className={css.extra}>
            <button type="button" className={css.exHead} aria-expanded={more === 'form'} onClick={() => setMore(more === 'form' ? '' : 'form')}>
              <span>🎨</span><span><b>แบบฟอร์มร้าน</b><small>{form ? `ใช้อยู่ · ${form.fields.length} ช่อง` : 'ให้ลูกค้าได้ข้อความสวย ๆ ตามแบบของร้าน'}</small></span><i>{more === 'form' ? '−' : '+'}</i></button>
            {more === 'form' && (
              <div className={css.exBody}>
                <small className="muted">วางข้อความที่เคยส่งลูกค้า 1 ใบ แล้วแตะคำที่เปลี่ยนทุกชิ้น ตอนเติมสต็อกใส่แค่ค่าที่เปลี่ยน</small>
                <div className={css.row}>
                  {form && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => saveForm(null)}>เลิกใช้แบบฟอร์ม</button>}
                  <button type="button" className="btn sm" onClick={() => setBuilding(true)}>{form ? '✏️ แก้แบบฟอร์ม' : '+ สร้างแบบฟอร์ม'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1. ลูกค้าได้อะไร */}
        <div className={css.seg} role="radiogroup" aria-label="ลูกค้าแต่ละคนได้">
          <button type="button" role="radio" aria-checked={!shared} className={!shared ? css.on : ''} onClick={() => { setShared(false); setRep('1'); }}>🔑 คนละชิ้น<small>ไม่ซ้ำกัน</small></button>
          <button type="button" role="radio" aria-checked={shared} className={shared ? css.on : ''} onClick={() => { setShared(true); setRep('100'); }}>🔗 เหมือนกันทุกคน<small>ลิงก์ · ไฟล์</small></button>
        </div>

        {/* 2. วางข้อมูล */}
        {!shared && !useFormNow && (
          <div className={css.mini} role="radiogroup" aria-label="แยกชิ้นยังไง">
            <button type="button" role="radio" aria-checked={split === 'line'} className={split === 'line' ? css.on : ''} onClick={() => setSplit('line')}>1 บรรทัด = 1 ชิ้น</button>
            <button type="button" role="radio" aria-checked={split === 'blank'} className={split === 'blank' ? css.on : ''} onClick={() => setSplit('blank')}>เว้นบรรทัด = ชิ้นใหม่</button>
          </div>
        )}
        {useFormNow && <div className={css.hint}>🎨 ใช้แบบฟอร์มร้าน · 1 บรรทัด = 1 ชิ้น ใส่ <b>{form!.fields.join(' | ')}</b></div>}
        <textarea className={`input ${css.paste}`} rows={shared ? 4 : 7} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={shared ? 'ข้อมูลที่ลูกค้าทุกคนได้ เช่น\nhttps://drive.google.com/…'
            : useFormNow ? form!.fields.map((f) => f).join(' | ') + '\n' + form!.fields.map((_, i) => `ค่า${i + 1}`).join(' | ')
            : split === 'line' ? 'วางทีละบรรทัด เช่น\nmail01@gmail.com | pass123 | จอ 1\nmail02@gmail.com | pass456 | จอ 2\nCODE-XXXX-0001'
            : 'ชิ้นละหลายบรรทัด เว้น 1 บรรทัดระหว่างชิ้น เช่น\n🔗 ลิงก์ทีม: https://…\n⏰ หมดอายุ: 30 วัน\n\n🔗 ลิงก์ทีม: https://…\n⏰ หมดอายุ: 30 วัน'} />

        {/* 3. ขายได้กี่คน */}
        <div className={css.rep}>
          <span>{shared ? 'ขายได้' : '1 ชิ้นขายได้'}</span>
          <button type="button" className="btn sm" aria-label="ลด" onClick={() => setRep(String(Math.max(1, n - 1)))}>−</button>
          <input className="input" inputMode="numeric" value={rep} aria-label="จำนวนคน" onChange={(e) => setRep(e.target.value.replace(/\D/g, '').slice(0, 3))} onBlur={() => setRep(String(n))} />
          <button type="button" className="btn sm" aria-label="เพิ่ม" onClick={() => setRep(String(Math.min(500, n + 1)))}>+</button>
          <span>คน</span>
        </div>

        {preview && (
          <details className={css.pv}><summary>👀 ลูกค้าจะเห็นแบบนี้</summary>
            <Delivered content={preview} warranty={option.days ? `${option.days} วันหลังซื้อ` : null} /></details>
        )}

        <div className={css.foot}>
          <span>{items.length ? (shared ? `ลูกค้า ${n} คนได้ข้อมูลนี้` : `${items.length} ชิ้น${n > 1 ? ` × ${n} คน` : ''}`) : 'ยังไม่ได้วางข้อมูล'}</span>
          <button type="button" className="btn primary" disabled={busy || !items.length} onClick={add}>{busy ? 'กำลังเพิ่ม…' : `เพิ่มสต็อก${items.length ? ` (${shared ? n : items.length * n})` : ''}`}</button>
        </div>
      </>}
    </div>
  );
}
