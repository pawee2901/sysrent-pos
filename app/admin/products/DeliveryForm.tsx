'use client';
import { useMemo, useState } from 'react';
import css from './dform.module.css';

/**
 * ฟอร์มส่งของ: ร้านวางข้อความที่เคยส่งลูกค้า 1 ใบ (กรอกข้อมูลแล้ว) → แตะคำที่เปลี่ยนทุกชิ้น = ช่อง
 * ตอนเติมสต็อกใส่แค่ค่าของช่อง → ระบบสร้างข้อความเต็มตามฟอร์ม (ลูกค้าเห็นทั้งก้อน + ปุ่มคัดลอก)
 * tpl เก็บช่องเป็น {{0}} {{1}} … ตามลำดับใน fields
 */
export type DForm = { tpl: string; fields: string[] };

const SLOT = /\{\{(\d+)\}\}/g;
/** ช่องของฟอร์มเดิมตอนกดแก้ (แสดงเป็นป้ายชื่อช่อง) */
const MARK = /^⟦(\d+)⟧$/;
/** บรรทัด --- ใช้คั่นชิ้นในสต็อก → ในฟอร์มเปลี่ยนเป็นเส้นแทน กันชิ้นถูกตัด */
const safe = (s: string) => s.replace(/\r\n/g, '\n').replace(/^\s*-{3,}\s*$/gm, '───────');
export const renderForm = (f: DForm, row: string[]) => safe(f.tpl.replace(SLOT, (_, i) => (row[Number(i)] ?? '').trim()));

type Tok = { t: string; space: boolean };
/** ตัดเป็นคำให้แตะ: เว้นวรรค / : / | แยกคำ (ยกเว้น : ระหว่างตัวเลข เช่น 22:00) */
function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  for (const part of s.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { out.push({ t: part, space: true }); continue; }
    for (const p of part.split(/((?<!\d)[:：|]|[:：|](?!\d))/)) if (p) out.push({ t: p, space: /^[:：|]$/.test(p) });
  }
  return out;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?$/;
/** เดาชื่อช่องจากคำหน้า (บรรทัดเดียวกัน) เช่น "PIN : 2222" → PIN */
function guess(toks: Tok[], k: number, picked: Set<number>): string {
  const v = toks[k].t;
  if (EMAIL.test(v)) return 'อีเมล';
  if (/^https?:\/\//.test(v)) return 'ลิงก์';
  if (/^\d{1,2}:\d{2}$/.test(v)) return 'เวลา';
  for (let j = k - 1; j >= 0; j--) {
    const x = toks[j];
    if (x.space && x.t.includes('\n')) break;
    if (x.space || picked.has(j)) continue;
    const w = x.t.replace(/[^\p{L}\p{N}]/gu, '');
    if (/\p{L}/u.test(w)) return w.slice(0, 30);
  }
  if (DATE.test(v)) return 'วันหมดอายุ';
  return '';
}
const uniqName = (n: string, taken: string[]) => { let s = n, i = 2; while (taken.includes(s)) s = `${n} ${i++}`; return s; };

/** สร้าง / แก้ฟอร์ม: 1 วาง → 2 แตะคำที่เปลี่ยน + ตั้งชื่อช่อง */
export function FormBuilder({ initial, onSave, onCancel, busy }: { initial: DForm | null; onSave: (f: DForm) => void; onCancel: () => void; busy?: boolean }) {
  // แก้ฟอร์มเดิม: เอาชื่อช่องใส่แทนค่าในตัวอย่าง แล้วเลือกช่องไว้ให้
  const start = useMemo(() => {
    if (!initial) return { text: '', picked: [] as number[], names: {} as Record<number, string> };
    const text = initial.tpl.replace(SLOT, (_, i) => `⟦${i}⟧`);
    const toks = tokenize(text), picked: number[] = [], names: Record<number, string> = {};
    toks.forEach((x, k) => { const m = MARK.exec(x.t); if (m) { picked.push(k); names[k] = initial.fields[Number(m[1])] || `ช่อง ${Number(m[1]) + 1}`; } });
    return { text, picked, names };
  }, [initial]);
  const [step, setStep] = useState<'paste' | 'pick'>(initial ? 'pick' : 'paste');
  const [text, setText] = useState(start.text);
  const [picked, setPicked] = useState<Set<number>>(new Set(start.picked));
  const [names, setNames] = useState<Record<number, string>>(start.names);
  const toks = useMemo(() => tokenize(text), [text]);
  const order = [...picked].sort((a, b) => a - b);

  function toggle(k: number) {
    const next = new Set(picked);
    if (next.has(k)) { next.delete(k); setPicked(next); return; }
    next.add(k);
    const taken = order.map((j) => names[j]).filter(Boolean);
    setPicked(next);
    setNames({ ...names, [k]: uniqName(guess(toks, k, next) || `ช่อง ${next.size}`, taken) });
  }
  function save() {
    const at = new Map(order.map((k, i) => [k, i]));
    const tpl = toks.map((x, k) => (at.has(k) ? `{{${at.get(k)}}}` : MARK.test(x.t) ? '' : x.t)).join('');
    onSave({ tpl: safe(tpl), fields: order.map((k, i) => (names[k] || '').trim() || `ช่อง ${i + 1}`) });
  }

  if (step === 'paste') return (
    <div className={css.box}>
      <b className={css.h}>1 · วางฟอร์มที่เคยส่งลูกค้า 1 ใบ (แบบกรอกข้อมูลแล้ว)</b>
      <textarea className="input" rows={9} value={text} autoFocus onChange={(e) => setText(e.target.value)}
        placeholder={'เช่น\n♡ Netflix 7 วัน ♡\nmail : someone@hotmail.com\npass : abc123\nจอที่ 02 | PIN : 2222\nหมดอายุ 27/11'} />
      <div className={css.row}>
        <button type="button" className="btn ghost sm" onClick={onCancel}>ยกเลิก</button>
        <button type="button" className="btn primary sm" disabled={!text.trim()} onClick={() => { setPicked(new Set()); setNames({}); setStep('pick'); }}>ต่อไป →</button>
      </div>
    </div>
  );

  return (
    <div className={css.box}>
      <b className={css.h}>2 · แตะคำที่เปลี่ยนไปทุกชิ้น (อีเมล · รหัส · PIN · วันหมดอายุ)</b>
      <div className={css.paper}>{toks.map((x, k) => x.space
        ? <span key={k}>{x.t}</span>
        : <button key={k} type="button" className={`${css.tok}${picked.has(k) ? ` ${css.on}` : ''}`} onClick={() => toggle(k)} title={picked.has(k) ? 'แตะอีกครั้งเพื่อยกเลิก' : 'แตะเพื่อทำเป็นช่อง'}>
          {picked.has(k) ? <><i>{names[k]}</i>{MARK.test(x.t) ? '' : x.t}</> : x.t}</button>)}
      </div>
      {order.length > 0 ? (
        <div className={css.names}>
          <small className="muted">ชื่อช่อง (ใช้ตอนเติมสต็อก)</small>
          {order.map((k, i) => (
            <label key={k} className={css.name}><span>{i + 1}</span>
              <input className="input" value={names[k] ?? ''} maxLength={30} onChange={(e) => setNames({ ...names, [k]: e.target.value })} />
              {!MARK.test(toks[k].t) && <small className="faint">เช่น {toks[k].t}</small>}</label>
          ))}
        </div>
      ) : <small style={{ color: 'var(--bad)' }}>แตะคำที่เปลี่ยนทุกชิ้นอย่างน้อย 1 คำ</small>}
      <div className={css.row}>
        <button type="button" className="btn ghost sm" onClick={() => setStep('paste')}>← วางฟอร์มใหม่</button>
        <button type="button" className="btn primary sm" disabled={!order.length || busy} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึกฟอร์ม'}</button>
      </div>
    </div>
  );
}
