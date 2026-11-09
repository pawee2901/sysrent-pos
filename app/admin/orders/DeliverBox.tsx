'use client';
import { useState } from 'react';
import { baht } from '@/components/Cart';
import { Delivered } from '@/components/Delivered';
import { input } from '@/components/dialog';

type Field = { label: string; value: string };

/** สินค้าสั่งทำ: ร้านทำบัญชีเสร็จแล้วกรอก → ส่งให้ลูกค้า (ลูกค้ารับที่หน้าประวัติการซื้อ) · แยกช่อง หรือข้อความยาว */
export function DeliverBox({ busy, refund, mailOn, onDeliver, onRefund }: { busy: boolean; refund: number; mailOn: boolean; onDeliver: (content: string, mail: boolean) => void; onRefund: (reason: string) => void }) {
  const [mail, setMail] = useState(true);
  const [mode, setMode] = useState<'fields' | 'text'>('fields');
  const [fields, setFields] = useState<Field[]>([{ label: 'อีเมล', value: '' }, { label: 'รหัสผ่าน', value: '' }, { label: 'โปรไฟล์', value: '' }]);
  const [text, setText] = useState('');
  const setF = (i: number, p: Partial<Field>) => setFields(fields.map((f, k) => (k === i ? { ...f, ...p } : f)));
  const content = mode === 'text' ? text.trim() : fields.filter((f) => f.value.trim()).map((f) => `${f.label.trim() || 'ข้อมูล'}: ${f.value.trim()}`).join('\n');

  async function refundNow() {
    const why = await input(`คืนเงิน ${baht(refund)} เข้ากระเป๋าลูกค้า`, { text: 'ใส่เหตุผล (ลูกค้าเห็นข้อความนี้)', placeholder: 'เช่น ของหมดชั่วคราว', ok: 'คืนเงิน', max: 300 });
    if (why) onRefund(why);
  }

  return (
    <div className="deliver">
      <div className="deliver-tabs">
        <button type="button" className={mode === 'fields' ? 'on' : ''} onClick={() => setMode('fields')}>📋 แยกช่อง</button>
        <button type="button" className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>📄 ข้อความยาว</button>
      </div>
      {mode === 'fields' ? (
        <div className="deliver-fields">
          {fields.map((f, i) => (
            <div key={i} className="deliver-row">
              <input className="input deliver-label" value={f.label} maxLength={30} aria-label={`ชื่อช่องที่ ${i + 1}`} onChange={(e) => setF(i, { label: e.target.value })} />
              <input className="input" value={f.value} placeholder={`ใส่${f.label || 'ข้อมูล'}`} onChange={(e) => setF(i, { value: e.target.value })} />
              {fields.length > 1 && <button type="button" className="icon-btn" aria-label="ลบช่องนี้" onClick={() => setFields(fields.filter((_, k) => k !== i))}>✕</button>}
            </div>
          ))}
          {fields.length < 8 && <button type="button" className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={() => setFields([...fields, { label: '', value: '' }])}>＋ เพิ่มช่อง</button>}
        </div>
      ) : (
        <textarea className="input" rows={5} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={'เช่น เชิญอีเมลเข้าครอบครัวแล้ว\nลิงก์เข้าร่วม: https://...'} />
      )}
      {content && <div className="deliver-preview"><small className="faint">👀 ลูกค้าจะเห็นแบบนี้ในหน้าประวัติการซื้อ</small><Delivered content={content} /></div>}
      {mailOn
        ? <label className="deliver-mail"><input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} /><span><b>📧 แจ้งลูกค้าทางอีเมล</b><small className="faint">ส่งให้เมื่อกดทำเสร็จแล้ว · ลูกค้าต้องใส่อีเมลในบัญชีไว้</small></span></label>
        : <small className="faint">🔒 แจ้งลูกค้าทางอีเมลใช้ได้กับแพ็กเกจ Pro ขึ้นไป</small>}
      <div className="deliver-acts">
        <button type="button" className="btn danger" disabled={busy} onClick={refundNow}>คืนเงิน {baht(refund)}</button>
        <button type="button" className="btn primary" disabled={busy || !content} onClick={() => onDeliver(content, mailOn && mail)}>{busy ? 'กำลังส่ง…' : 'ทำเสร็จแล้ว ส่งให้ลูกค้า'}</button>
      </div>
    </div>
  );
}
