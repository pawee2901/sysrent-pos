'use client';
import { useEffect, useState } from 'react';

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const pad = (n: number) => String(n).padStart(2, '0');
type Parts = { d: number; m: number; y: number };
const EMPTY: Parts = { d: 0, m: 0, y: 0 };
const parse = (v: string): Parts => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); return m ? { d: +m[3], m: +m[2], y: +m[1] } : EMPTY; };
const daysIn = (m: number, y: number) => (m && y ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 31);

/**
 * ช่องวันที่ภาษาไทย: วัน / เดือน / ปี พ.ศ. (ปฏิทินของเบราว์เซอร์บังคับภาษาไทยหรือ พ.ศ. ไม่ได้)
 * ค่าเข้า-ออกเป็น YYYY-MM-DD แบบ ค.ศ. เหมือน <input type="date"> · ยังเลือกไม่ครบ = ''
 */
export function ThaiDateInput({ value, onChange, max, clearable = true, label }: { value: string; onChange: (v: string) => void; max?: string; clearable?: boolean; label: string }) {
  const [p, setP] = useState<Parts>(() => parse(value));
  // ค่าจากภายนอกเปลี่ยน (เช่น เปิดฟอร์มแก้ไข / ล้างฟอร์ม) · ยังเลือกไม่ครบอยู่ = ไม่ทับ
  useEffect(() => { setP((cur) => (value ? parse(value) : cur.d && cur.m && cur.y ? EMPTY : cur)); }, [value]);

  const thisYear = new Date(Date.now() + 7 * 3_600_000).getUTCFullYear();
  const maxY = max ? +max.slice(0, 4) : thisYear + 10;
  const minY = Math.min(thisYear - 1, p.y || thisYear - 1);
  const years = Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i);

  function set(patch: Partial<Parts>) {
    const q = { ...p, ...patch };
    q.d = Math.min(q.d, daysIn(q.m, q.y));
    if (!(q.d && q.m && q.y)) { setP(q); onChange(''); return; }
    let v = `${q.y}-${pad(q.m)}-${pad(q.d)}`;
    if (max && v > max) v = max;
    setP(parse(v)); onChange(v);
  }

  return (
    <div className="thdate" role="group" aria-label={label}>
      <select className="input" aria-label={`${label}: วัน`} value={p.d || ''} onChange={(e) => set({ d: +e.target.value })}>
        <option value="">วัน</option>
        {Array.from({ length: daysIn(p.m, p.y) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select>
      <select className="input" aria-label={`${label}: เดือน`} value={p.m || ''} onChange={(e) => set({ m: +e.target.value })}>
        <option value="">เดือน</option>
        {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select className="input" aria-label={`${label}: ปี พ.ศ.`} value={p.y || ''} onChange={(e) => set({ y: +e.target.value })}>
        <option value="">ปี</option>
        {years.map((y) => <option key={y} value={y}>{y + 543}</option>)}
      </select>
      {clearable && (p.d || p.m || p.y) ? <button type="button" className="btn ghost sm" onClick={() => { setP(EMPTY); onChange(''); }}>ล้าง</button> : null}
    </div>
  );
}
