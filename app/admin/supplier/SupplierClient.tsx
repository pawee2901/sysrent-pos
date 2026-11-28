'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLogo } from '@/components/AppLogo';
import { api, baht } from '@/components/Cart';
import { ask, notify } from '@/components/dialog';
import css from '../fin.module.css';

export type SupplierRow = {
  id: string; name: string; buy_url: string; method: 'POST' | 'GET'; body_type: 'json' | 'form'; headers: string; body_tpl: string; hasKey: boolean;
  ok_path: string; ok_value: string; account_path: string; error_path: string; balance_url: string; balance_path: string; active: boolean;
};
export type MapRow = { id: string; name: string; image: string; template: string; active: boolean; options: { id: string; name: string; price: number; cost: number | null; active: boolean; supplier: string | null; code: string }[] };
export type LogRow = { id: string; supplier: string; kind: string; ok: boolean; http: number | null; note: string; response: string; ms: number; when: string };
type Failed = { id: string; name: string; note: string; code: string; when: string };
type Form = Omit<SupplierRow, 'id' | 'hasKey'> & { id?: string; api_key: string; hasKey: boolean; clear_key: boolean };

const PRESETS: { k: string; l: string; d: string; f: Partial<Form> }[] = [
  { k: 'json', l: 'JSON ทั่วไป', d: 'ส่งข้อมูลแบบ JSON · คีย์อยู่ในหัวข้อ Authorization', f: {
    method: 'POST', body_type: 'json', headers: 'Authorization: Bearer {{key}}',
    body_tpl: '{\n  "product_id": "{{code}}",\n  "quantity": {{qty}},\n  "ref": "{{order}}"\n}', ok_path: 'status', ok_value: 'success', account_path: 'data', error_path: 'message' } },
  { k: 'form', l: 'ฟอร์ม (keyapi)', d: 'ส่งแบบฟอร์ม · คีย์อยู่ในข้อมูลที่ส่ง', f: {
    method: 'POST', body_type: 'form', headers: '',
    body_tpl: 'keyapi={{key}}&id={{code}}&username_customer={{user}}', ok_path: 'status', ok_value: 'success', account_path: 'info', error_path: 'message' } },
];
const blank = (): Form => ({ name: '', buy_url: '', method: 'POST', body_type: 'json', headers: '', body_tpl: '', api_key: '', hasKey: false, clear_key: false, ok_path: '', ok_value: '', account_path: '', error_path: '', balance_url: '', balance_path: '', active: true, ...PRESETS[0].f });
const host = (u: string) => { try { return new URL(u).host; } catch { return u; } };

/** API ร้านส่ง: ร้านกรอกเองได้ทุกเจ้า → ผูกกับแพ็กเกจ → ลูกค้าจ่ายแล้วระบบซื้อและส่งของให้อัตโนมัติ */
export function SupplierClient({ ready, suppliers, maps, logs, failed }: { ready: boolean; suppliers: SupplierRow[]; maps: MapRow[]; logs: LogRow[]; failed: Failed[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'sup' | 'map' | 'fail' | 'log'>(suppliers.length ? 'map' : 'sup');
  const [edit, setEdit] = useState<Form | null>(null);
  const [test, setTest] = useState<SupplierRow | null>(null);
  const [bal, setBal] = useState<Record<string, string>>({});
  const [openLog, setOpenLog] = useState('');
  const linked = maps.reduce((n, p) => n + p.options.filter((o) => o.supplier).length, 0);

  async function checkBalance(s: SupplierRow) {
    setBal({ ...bal, [s.id]: 'กำลังเช็ก…' });
    const r = await api<{ result: { ok: boolean; value: string; message: string } }>('/api/admin/suppliers', { action: 'balance', id: s.id });
    setBal((b) => ({ ...b, [s.id]: !r.ok ? r.error : r.data.result.ok ? `ยอดคงเหลือ ${r.data.result.value}` : r.data.result.message }));
  }
  async function retry(f: Failed) {
    if (!(await ask(`ลองซื้อจากร้านส่งใหม่ — ${f.name}?`, { text: 'ถ้าครั้งก่อนร้านส่งตัดเงินไปแล้วแต่ระบบอ่านผลไม่ได้ อาจซื้อซ้ำ — ตรวจที่ร้านส่งก่อน', ok: 'ลองใหม่' }))) return;
    const r = await api('/api/admin/suppliers', { action: 'retry', item_id: f.id });
    if (!r.ok) { notify(r.error, 'error'); router.refresh(); return; }
    notify('ส่งของให้ลูกค้าแล้ว'); router.refresh();
  }

  return (
    <div className={css.wrap}>
      <div className="page-head"><div><h1>API ร้านส่ง</h1><p>เชื่อม API ร้านส่งแอปพรีเมียม ลูกค้าจ่ายแล้วระบบสั่งซื้อและส่งบัญชีให้อัตโนมัติ</p></div>
        <div className="actions"><button type="button" className="btn primary" disabled={!ready} onClick={() => setEdit(blank())}>+ เพิ่มร้านส่ง</button></div></div>

      {!ready && <p className={`${css.note} ${css.warn}`}>ต้องรัน SQL <code>0057_supplier_api.sql</code> ใน Supabase ก่อน ถึงจะใช้งานได้</p>}

      <div className={css.tabs} role="tablist">
        {([['sup', 'ร้านส่ง', suppliers.length], ['map', 'ผูกสินค้า', linked], ['fail', 'ส่งไม่สำเร็จ', failed.length], ['log', 'ประวัติการเรียก', logs.length]] as const).map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`${tab === k ? css.on : ''} ${k === 'fail' && n ? css.bad : ''}`} onClick={() => setTab(k)}>{l}<b>{n}</b></button>))}
      </div>

      {tab === 'sup' && (
        <section className={css.box}>
          {!suppliers.length ? <p className={css.empty}>ยังไม่มีร้านส่ง — กด &quot;เพิ่มร้านส่ง&quot; แล้วกรอก URL และคีย์ API ตามเอกสารของร้านส่ง</p> : (
            <div className={css.rows}>{suppliers.map((s) => (
              <div key={s.id} className={css.row} style={{ flexWrap: 'wrap' }}>
                <span className={css.ic}>{s.name.slice(0, 1).toUpperCase()}</span>
                <div className={css.main}><b>{s.name} {!s.active && <span className={css.tag}>ปิดอยู่</span>}</b>
                  <small>{s.method} · {host(s.buy_url)} · {s.hasKey ? 'มีคีย์ API' : 'ไม่มีคีย์'}</small>
                  {bal[s.id] && <small style={{ color: 'var(--text)' }}>{bal[s.id]}</small>}</div>
                <div className={css.acts}>
                  {s.balance_url && <button type="button" className="btn soft sm" onClick={() => checkBalance(s)}>เช็กยอด</button>}
                  <button type="button" className="btn soft sm" onClick={() => setTest(s)}>ทดลอง</button>
                  <button type="button" className="btn sm" onClick={() => setEdit({ ...s, api_key: '', clear_key: false })}>แก้ไข</button>
                </div>
              </div>))}</div>
          )}
        </section>
      )}

      {tab === 'map' && <>
        <p className={css.note}>เลือกร้านส่งและใส่ <b>รหัสสินค้าของร้านส่ง</b> ให้แต่ละแพ็กเกจ · ลูกค้าจ่ายเงินแล้ว ระบบสั่งซื้อและส่งบัญชีให้ทันที · ใช้ได้กับสินค้าแบบ <b>สั่งทำ</b> (สร้างที่ สินค้า → เพิ่มสินค้า → วิธีส่งของ: สั่งทำ)</p>
        {!maps.length ? <section className={css.box}><p className={css.empty}>ยังไม่มีสินค้าแบบสั่งทำ</p></section>
          : maps.map((p) => (
            <section key={p.id} className={css.box}>
              <div className={css.boxHead}><span className={css.ic} style={{ width: 30, height: 30 }}><AppLogo image={p.image} template={p.template} name={p.name} /></span><h2>{p.name}</h2>{!p.active && <span className={css.tag}>ปิดขาย</span>}</div>
              <div className={css.rows}>{p.options.map((o) => <MapLine key={o.id} o={o} suppliers={suppliers} ready={ready} onSaved={() => router.refresh()} />)}</div>
            </section>))}
      </>}

      {tab === 'fail' && (
        <section className={css.box}>
          {!failed.length ? <p className={css.empty}>ไม่มีรายการค้าง — ทุกออเดอร์ที่ผูก API ส่งสำเร็จ</p> : (
            <div className={css.rows}>{failed.map((f) => (
              <div key={f.id} className={css.row} style={{ flexWrap: 'wrap' }}>
                <div className={css.main}><b>#{f.code} · {f.name}</b><small style={{ color: 'var(--bad)', whiteSpace: 'normal' }}>{f.note}</small><small>{f.when}</small></div>
                <div className={css.acts}><button type="button" className="btn primary sm" onClick={() => retry(f)}>ลองใหม่</button></div>
              </div>))}</div>
          )}
          {failed.length > 0 && <p className={css.note} style={{ borderRadius: 0 }}>หรือส่งบัญชีเอง / คืนเงิน ได้ที่หน้า ออเดอร์ → แท็บ รอส่ง</p>}
        </section>
      )}

      {tab === 'log' && (
        <section className={css.box}>
          {!logs.length ? <p className={css.empty}>ยังไม่มีการเรียก API</p> : (
            <div className={css.rows}>{logs.map((l) => (
              <div key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <button type="button" className={css.row} style={{ width: '100%', border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpenLog(openLog === l.id ? '' : l.id)}>
                  <span className={`${css.tag} ${l.ok ? css.tagIn : css.tagOut}`}>{l.ok ? 'สำเร็จ' : 'ไม่สำเร็จ'}</span>
                  <div className={css.main}><b>{l.supplier} · {l.kind === 'buy' ? 'สั่งซื้อ' : l.kind === 'test' ? 'ทดลอง' : 'เช็กยอด'}</b><small>{l.note}{l.http ? ` · HTTP ${l.http}` : ''} · {(l.ms / 1000).toFixed(1)} วิ</small></div>
                  <small className="muted" style={{ flex: 'none' }}>{l.when}</small>
                </button>
                {openLog === l.id && <div style={{ padding: '0 16px 12px' }}><pre className={css.code}>{l.response || '(ไม่มีข้อมูลตอบกลับ)'}</pre></div>}
              </div>))}</div>
          )}
        </section>
      )}

      {edit && <SupplierForm init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); router.refresh(); }} />}
      {test && <TestBox s={test} onClose={() => { setTest(null); router.refresh(); }} />}
    </div>
  );
}

/** แพ็กเกจ 1 แถว: เลือกร้านส่ง + รหัสสินค้าของร้านส่ง */
function MapLine({ o, suppliers, ready, onSaved }: { o: MapRow['options'][number]; suppliers: SupplierRow[]; ready: boolean; onSaved: () => void }) {
  const [sup, setSup] = useState(o.supplier ?? '');
  const [code, setCode] = useState(o.code);
  const [busy, setBusy] = useState(false);
  const dirty = sup !== (o.supplier ?? '') || code !== o.code;
  async function save() {
    if (sup && !code.trim()) { notify('ใส่รหัสสินค้าของร้านส่ง', 'error'); return; }
    setBusy(true);
    const r = await api('/api/admin/suppliers', { action: 'map', option_id: o.id, supplier_id: sup || null, api_code: code });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify(sup ? 'ผูก API แล้ว' : 'ยกเลิกการผูกแล้ว'); onSaved();
  }
  return (
    <div className={css.row} style={{ flexWrap: 'wrap' }}>
      <div className={css.main} style={{ minWidth: 140 }}><b>{o.name} {!o.active && <span className={css.tag}>ปิด</span>}</b><small>ขาย {baht(o.price)}{o.cost !== null ? ` · ทุน ${baht(o.cost)}` : ''}</small></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 300px' }}>
        <select className="input" style={{ flex: '1 1 140px' }} value={sup} disabled={!ready} aria-label="ร้านส่ง" onChange={(e) => setSup(e.target.value)}>
          <option value="">ไม่ผูก — ร้านส่งเอง</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {sup && <input className={`input ${css.mono}`} style={{ flex: '1 1 120px' }} placeholder="รหัสสินค้าร้านส่ง" value={code} maxLength={80} aria-label="รหัสสินค้าของร้านส่ง" onChange={(e) => setCode(e.target.value)} />}
        {dirty && <button type="button" className="btn primary sm" disabled={busy} onClick={save}>{busy ? '…' : 'บันทึก'}</button>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className={css.mBg} onClick={onClose}>
      <div className={css.modal} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className={css.mHead}><b>{title}</b><button type="button" className="icon-btn" onClick={onClose} aria-label="ปิด">✕</button></div>
        <div className={css.mBody}>{children}</div>
        {foot && <div className={css.mFoot}>{foot}</div>}
      </div>
    </div>
  );
}

function SupplierForm({ init, onClose, onSaved }: { init: Form; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(init);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Form>) => setF({ ...f, ...p });
  async function save() {
    setBusy(true);
    const r = await api('/api/admin/suppliers', { action: 'save', ...f, hasKey: undefined });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('บันทึกร้านส่งแล้ว'); onSaved();
  }
  async function del() {
    if (!f.id || !(await ask(`ลบร้านส่ง "${f.name}"?`, { text: 'แพ็กเกจที่ผูกไว้จะกลับเป็นร้านส่งเอง', ok: 'ลบ', danger: true }))) return;
    const r = await api('/api/admin/suppliers', { action: 'delete', id: f.id });
    if (!r.ok) { notify(r.error, 'error'); return; }
    notify('ลบแล้ว'); onSaved();
  }
  return (
    <Modal title={f.id ? 'แก้ไขร้านส่ง' : 'เพิ่มร้านส่ง'} onClose={onClose} foot={<>
      {f.id && <button type="button" className="btn ghost" style={{ flex: 'none', color: 'var(--bad)' }} onClick={del}>ลบ</button>}
      <button type="button" className="btn primary" disabled={busy || !f.name.trim() || !f.buy_url.trim()} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
      <div className={css.form}>
        {!f.id && <div className="field"><span>เริ่มจากรูปแบบ</span>
          <div className={css.kind} style={{ gridTemplateColumns: '1fr 1fr' }}>{PRESETS.map((p) => (
            <button key={p.k} type="button" className={f.body_type === p.f.body_type ? css.on : ''} title={p.d} onClick={() => set(p.f)}>{p.l}</button>))}</div>
          <small className={css.help}>เลือกแบบที่ใกล้กับเอกสาร API ของร้านส่ง แล้วแก้ช่องด้านล่างให้ตรง</small></div>}
        <label className="field"><span>ชื่อร้านส่ง</span><input className="input" maxLength={40} value={f.name} placeholder="เช่น ร้านส่ง A" onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="field"><span>URL สั่งซื้อ</span><input className={`input ${css.mono}`} maxLength={500} value={f.buy_url} placeholder="https://example.com/api/buy" onChange={(e) => set({ buy_url: e.target.value })} /></label>
        <div className={css.two}>
          <label className="field"><span>วิธีส่ง</span><select className="input" value={f.method} onChange={(e) => set({ method: e.target.value as Form['method'] })}><option value="POST">POST</option><option value="GET">GET</option></select></label>
          <label className="field"><span>รูปแบบข้อมูล</span><select className="input" value={f.body_type} disabled={f.method === 'GET'} onChange={(e) => set({ body_type: e.target.value as Form['body_type'] })}><option value="json">JSON</option><option value="form">ฟอร์ม (x-www-form-urlencoded)</option></select></label>
        </div>
        <label className="field"><span>คีย์ API</span><input className={`input ${css.mono}`} type="password" autoComplete="off" maxLength={500} value={f.api_key}
          placeholder={f.hasKey ? 'บันทึกไว้แล้ว — เว้นว่าง = ใช้คีย์เดิม' : 'วางคีย์ API ของร้านส่ง'} onChange={(e) => set({ api_key: e.target.value })} />
          <small className={css.help}>เก็บแบบเข้ารหัส · ใส่ในหัวข้อหรือข้อมูลที่ส่งด้วย <code>{'{{key}}'}</code></small></label>
        <label className="field"><span>หัวข้อ (headers) บรรทัดละ 1 รายการ</span><textarea className={`input ${css.mono}`} rows={2} maxLength={1000} value={f.headers} placeholder="Authorization: Bearer {{key}}" onChange={(e) => set({ headers: e.target.value })} /></label>
        {f.method === 'POST' && <label className="field"><span>ข้อมูลที่ส่ง</span><textarea className={`input ${css.mono}`} rows={5} maxLength={2000} value={f.body_tpl} onChange={(e) => set({ body_tpl: e.target.value })} /></label>}
        <p className={css.help} style={{ margin: 0 }}>ตัวแปร: <code>{'{{key}}'}</code> คีย์ API · <code>{'{{code}}'}</code> รหัสสินค้าร้านส่ง · <code>{'{{qty}}'}</code> จำนวน · <code>{'{{order}}'}</code> เลขออเดอร์ · <code>{'{{info}}'}</code> ข้อมูลที่ลูกค้ากรอก · <code>{'{{user}}'}</code> ชื่อลูกค้า</p>

        <div className={css.sect}><b>อ่านผลตอบกลับ</b>
          <div className={css.two}>
            <label className="field"><span>ช่องสถานะ</span><input className={`input ${css.mono}`} value={f.ok_path} placeholder="status" onChange={(e) => set({ ok_path: e.target.value })} /></label>
            <label className="field"><span>ค่าที่แปลว่าสำเร็จ</span><input className={`input ${css.mono}`} value={f.ok_value} placeholder="success" onChange={(e) => set({ ok_value: e.target.value })} /></label>
          </div>
          <div className={css.two}>
            <label className="field"><span>ช่องข้อมูลบัญชี (ส่งให้ลูกค้า)</span><input className={`input ${css.mono}`} value={f.account_path} placeholder="data.account" onChange={(e) => set({ account_path: e.target.value })} /></label>
            <label className="field"><span>ช่องข้อความผิดพลาด</span><input className={`input ${css.mono}`} value={f.error_path} placeholder="message" onChange={(e) => set({ error_path: e.target.value })} /></label>
          </div>
          <small className={css.help}>เขียนตำแหน่งแบบ <code>data.account</code> หรือ <code>result[0].email</code> · ช่องสถานะว่าง = ดูแค่ว่าตอบกลับสำเร็จ (HTTP 200)</small>
        </div>

        <div className={css.sect}><b>เช็กยอดเงินที่ร้านส่ง (ไม่บังคับ)</b>
          <div className={css.two}>
            <label className="field"><span>URL เช็กยอด</span><input className={`input ${css.mono}`} value={f.balance_url} placeholder="https://example.com/api/balance" onChange={(e) => set({ balance_url: e.target.value })} /></label>
            <label className="field"><span>ช่องยอดเงิน</span><input className={`input ${css.mono}`} value={f.balance_path} placeholder="balance" onChange={(e) => set({ balance_path: e.target.value })} /></label>
          </div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />เปิดใช้งาน (ปิด = ออเดอร์ใหม่ไม่เรียก API รอร้านส่งเอง)</label>
      </div>
    </Modal>
  );
}

function TestBox({ s, onClose }: { s: SupplierRow; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; http: number | null; account: string; message: string; raw: string; ms: number } | null>(null);
  async function run() {
    if (!(await ask('ทดลองสั่งซื้อจริง?', { text: `ระบบจะเรียก API ของ ${s.name} จริง — ถ้าร้านส่งตัดเงิน จะได้บัญชีจริง 1 ชิ้น`, ok: 'สั่งซื้อทดลอง' }))) return;
    setBusy(true); setRes(null);
    const r = await api<{ result: NonNullable<typeof res> }>('/api/admin/suppliers', { action: 'test', id: s.id, code, info });
    setBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    setRes(r.data.result);
  }
  return (
    <Modal title={`ทดลองสั่งซื้อ · ${s.name}`} onClose={onClose} foot={<button type="button" className="btn primary" disabled={busy} onClick={run}>{busy ? 'กำลังเรียก API…' : 'ทดลองสั่งซื้อ'}</button>}>
      <p className={`${css.note} ${css.warn}`}>การทดลองคือการสั่งซื้อจริง 1 ครั้ง ใช้เพื่อตรวจว่าตั้งค่าอ่านผลถูกต้อง</p>
      <label className="field"><span>รหัสสินค้าของร้านส่ง</span><input className={`input ${css.mono}`} value={code} maxLength={80} onChange={(e) => setCode(e.target.value)} /></label>
      <label className="field"><span>ข้อมูลลูกค้า (ไม่บังคับ)</span><input className="input" value={info} maxLength={300} placeholder="ถ้าสินค้าต้องใช้อีเมลลูกค้า" onChange={(e) => setInfo(e.target.value)} /></label>
      {res && <>
        <p className={css.note} style={{ color: res.ok ? 'var(--ok)' : 'var(--bad)', fontWeight: 600 }}>{res.ok ? 'สำเร็จ — ข้อมูลที่จะส่งให้ลูกค้า:' : `ไม่สำเร็จ — ${res.message}`}{res.http ? ` (HTTP ${res.http} · ${(res.ms / 1000).toFixed(1)} วิ)` : ''}</p>
        {res.ok && <pre className={css.code}>{res.account}</pre>}
        <div className="field"><span>ผลตอบกลับทั้งหมด</span><pre className={css.code}>{res.raw || '(ว่าง)'}</pre></div>
      </>}
    </Modal>
  );
}
