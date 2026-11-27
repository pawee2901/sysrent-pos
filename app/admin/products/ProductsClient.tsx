'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ask, input, notify } from '@/components/dialog';
import { uploadImage } from '@/components/upload';
import { api, baht } from '@/components/Cart';
import { AppLogo } from '@/components/AppLogo';
import { FULFILL_LABEL } from '@/lib/templates';
import type { Product } from '@/lib/catalog';
import { CategoriesCard } from './CategoriesCard';
import { Delivered } from '@/components/Delivered';
import { markPlain } from '@/lib/fields';
import { FormBuilder, renderForm, type DForm } from './DeliveryForm';
import dcss from './dform.module.css';
import { StockList } from './StockList';

type OptF = { id?: string; name: string; price: string; compare_at: string; cost: string; duration_days: string; agent_price: string; active: boolean };
type Form = { id?: string; name: string; category: string; description: string; image: string; template: string; fulfillment: 'stock' | 'slot' | 'manual'; badge: string; askInfo: string; active: boolean; options: OptF[]; preorder: boolean; preorderNote: string; preorderLimit: string };
const num = (s: string) => (s.trim() === '' ? null : Number(s));
type StockForm = { optionId: string; mode: 'fields' | 'block' | 'form'; text: string; repeat: string; cols: string[]; rows: string[][]; otp: string[]; otpAll: string; dform?: DForm | null; building?: boolean; shared?: boolean };
const DEFAULT_COLS = ['อีเมล', 'รหัสผ่าน', 'โปรไฟล์'];
const newStock = (optionId: string): StockForm => ({ optionId, mode: 'fields', text: '', repeat: '1', cols: [...DEFAULT_COLS], rows: [['', '', '']], otp: [], otpAll: '' });
/** เติมค่าที่ขาด (เช่น state เก่าจากก่อนอัปเดตหน้า ที่ยังไม่มีตาราง) */
const fillStock = (st: Partial<StockForm> & { optionId: string }): StockForm => {
  const base = newStock(st.optionId);
  const cols = st.cols?.length ? st.cols : base.cols;
  const rows = st.rows?.length ? st.rows : [cols.map(() => '')];
  return { ...base, ...st, cols, rows, text: st.text ?? '', repeat: st.repeat ?? '1', otp: st.otp ?? [], otpAll: st.otpAll ?? '' };
};
/** ตาราง → ชิ้นละหลายบรรทัด "หัวข้อ: ค่า" คั่นชิ้นด้วย --- (ลูกค้าเห็นแยกช่อง + ปุ่มคัดลอก) */
function fieldsToText(st: StockForm) {
  const cols = st.cols ?? [];
  return (st.rows ?? [])
    .map((r) => cols.map((c, i) => (r[i]?.trim() ? `${c.trim() || `ข้อมูล ${i + 1}`}: ${r[i].trim()}` : '')).filter(Boolean).join('\n'))
    .filter(Boolean).join('\n---\n');
}
/** ฟอร์มส่งของ → ชิ้นละ 1 ข้อความเต็มตามฟอร์ม (เฉพาะชิ้นที่กรอก) คั่นด้วย --- */
function formText(st: StockForm) {
  const fm = st.dform;
  if (!fm) return '';
  return (st.rows ?? []).filter((r) => r.some((v) => v?.trim())).map((r) => renderForm(fm, r).replace(/^\n+|\s+$/g, '')).join('\n---\n');
}
const stockText = (st: StockForm) => (st.shared ? (st.text ?? '').replace(/\r\n/g, '\n').replace(/^\s*-{3,}\s*$/gm, '───────').trim() : st.mode === 'fields' ? fieldsToText(st) : st.mode === 'form' ? formText(st) : st.text);
/** เปิดโหมดฟอร์มด้วยฟอร์มที่บันทึกไว้ (ช่องในตาราง = ช่องของฟอร์ม) */
const withForm = (st: StockForm, fm: DForm): StockForm => ({ ...st, mode: 'form', dform: fm, building: false, cols: [...fm.fields], rows: [fm.fields.map(() => '')], otp: [] });
/** ข้อความชิ้นแรก (ไว้โชว์ตัวอย่างว่าลูกค้าจะเห็นยังไง) */
function previewOf(st: StockForm): string {
  if (st.shared) return markPlain(stockText(st));
  if (st.mode === 'fields') return fieldsToText(st).split('\n---\n')[0] ?? '';
  if (st.mode === 'form') return markPlain(formText(st).split('\n---\n')[0] ?? '');
  const t = (st.text ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return '';
  return markPlain((t.split(/^\s*-{3,}\s*$/m).find((s) => s.trim()) ?? '').replace(/^\n+|\s+$/g, ''));
}
/** นับจำนวนชิ้นที่จะเพิ่ม (ให้ตรงกับที่เซิร์ฟเวอร์แยก) */
function stockCount(st: StockForm) {
  const rep = Math.max(1, Number(st.repeat) || 1);
  if (st.shared) return stockText(st) ? `ลูกค้า ${rep.toLocaleString('th-TH')} คนแรกได้ข้อมูลนี้เหมือนกัน` : 'ยังไม่มีข้อมูล';
  if (st.mode !== 'block') { const n = (st.rows ?? []).filter((r) => r.some((v) => v.trim())).length; return n ? `จะเพิ่ม ${n} ชิ้น${rep > 1 ? ` × ${rep} คน = ${n * rep} ออเดอร์` : ''}` : 'ยังไม่ได้กรอกข้อมูล'; }
  const t = (st.text ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return 'ยังไม่มีข้อความ';
  const n = new Set(t.split(/^\s*-{3,}\s*$/m).map((s) => s.replace(/^\n+|\s+$/g, '')).filter((s) => s.trim())).size * Math.max(1, Number(st.repeat) || 1);
  return `จะเพิ่ม ${n.toLocaleString('th-TH')} ชิ้น`;
}
/** ช่องที่ยังไม่ได้กรอก (ว่าง = ครบแล้ว) */
const missing = (f: Form) => [!f.name.trim() && 'ชื่อสินค้า', !f.options.length && 'แพ็กเกจ', f.options.some((o) => !(Number(o.price) > 0)) && 'ราคาขาย', f.options.some((o) => !o.name.trim()) && 'ชื่อแพ็กเกจ'].filter(Boolean).join(' · ');
const blank = (): Form => ({ name: '', category: '', description: '', image: '', template: '', fulfillment: 'stock', badge: '', askInfo: '', active: true, preorder: false, preorderNote: '', preorderLimit: '', options: [{ name: '30 วัน', price: '', compare_at: '', cost: '', duration_days: '30', agent_price: '', active: true }] });
const fromProduct = (p: Product, ap: Record<string, number> = {}): Form => ({
  id: p.id, name: p.name, category: p.category, description: p.description, image: p.image, template: p.template, fulfillment: p.fulfillment, badge: p.badge, askInfo: p.askInfo, active: p.active, preorder: p.preorder, preorderNote: p.preorderNote, preorderLimit: p.preorderLimit ? String(p.preorderLimit) : '',
  options: p.options.map((o) => ({ id: o.id, name: o.name, price: String(o.price), compare_at: o.compareAt?.toString() ?? '', cost: o.cost?.toString() ?? '', duration_days: o.durationDays?.toString() ?? '', agent_price: ap[o.id]?.toString() ?? '', active: o.active })),
});

/** สินค้า: ตาราง + เพิ่มจากแม่แบบ + แผงแก้ไข (ข้อมูล · แพ็กเกจ · สต็อก) */
export function ProductsClient({ products, categories, usages, usageReady, usageImages, images, imgReady, galleryReady, agentPrices, agentsOn, otp, forms, formReady }: { products: Product[]; categories: string[]; usages: Record<string, string>; usageReady: boolean; usageImages: Record<string, string[]>; images: Record<string, string[]>; imgReady: boolean; galleryReady: boolean; agentPrices: Record<string, number>; agentsOn: boolean; otp: { ready: boolean; apps: { id: string; name: string }[]; picks: Record<string, string> } | null; forms: Record<string, DForm>; formReady: boolean }) {
  const [usage, setUsage] = useState('');
  const [otpApp, setOtpApp] = useState(''); // ปุ่มรับ OTP: '' = ปิด
  const [usageImgs, setUsageImgs] = useState<string[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  /** อัปหลายรูปพร้อมกันครั้งละ 3 ไฟล์ (เรียงตามที่เลือก) · ไฟล์ที่พัง = ข้าม แล้วแจ้ง */
  async function uploadMany(files: File[]): Promise<string[]> {
    const out: (string | null)[] = new Array(files.length).fill(null);
    let err = '';
    setBusy(true);
    for (let i = 0; i < files.length; i += 3) {
      await Promise.all(files.slice(i, i + 3).map(async (fl, k) => { const r = await uploadImage(fl); if (r.ok) out[i + k] = r.data.url; else err = r.error; }));
    }
    setBusy(false);
    if (err) setMsg(err);
    return out.filter((u): u is string => !!u);
  }
  const counts = products.reduce<Record<string, number>>((m, p) => ({ ...m, [p.category]: (m[p.category] ?? 0) + 1 }), {});
  const router = useRouter();
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [stock, setStock] = useState<StockForm | null>(null);
  const [formMap, setFormMap] = useState<Record<string, DForm>>(forms);
  const [stockTab, setStockTab] = useState<'add' | 'list'>('add');
  /** เปิดเติมสต็อก: แพ็กเกจที่มีฟอร์มส่งของแล้ว = เปิดโหมดฟอร์มให้เลย */
  const openStock = (optionId: string): StockForm => { const fm = formMap[optionId]; return fm ? withForm(newStock(optionId), fm) : newStock(optionId); };
  async function saveForm(fm: DForm) {
    if (!stock) return;
    setBusy(true);
    const r = await api('/api/admin/products', { action: 'form', optionId: stock.optionId, form: fm });
    setBusy(false);
    if (!r.ok) notify(formReady ? r.error : 'ใช้ฟอร์มนี้ได้เลย แต่ระบบยังจำฟอร์มไว้ไม่ได้ (ต้องรัน SQL 0046_delivery_form.sql)', formReady ? 'error' : 'info');
    else notify('บันทึกฟอร์มส่งของแล้ว ✓');
    setFormMap((m) => ({ ...m, [stock.optionId]: fm }));
    setStock(withForm(fillStock(stock), fm));
  }
  const [q, setQ] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const editing = f?.id ? products.find((p) => p.id === f.id) : undefined;
  const stockBox = useRef<HTMLDivElement>(null);
  // เปิดฟอร์มเพิ่มสต็อกแล้วเลื่อนไปหา (แพ็กเกจอาจอยู่นอกจอ โดยเฉพาะบนมือถือ)
  useEffect(() => { if (stock?.optionId) stockBox.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [stock?.optionId]);

  /** เปิดแผงแก้ไข · ส่ง optionId มา = เปิดฟอร์มเพิ่มสต็อกของแพ็กเกจนั้นให้เลย */
  function openProduct(p: Product, stockOptionId?: string) {
    setF(fromProduct(p, agentPrices)); setOtpApp(otp?.picks[p.id] ?? ''); setUsage(usages[p.id] ?? ''); setUsageImgs(usageImages[p.id] ?? []); setGallery(images[p.id] ?? []); setMsg('');
    setStock(stockOptionId ? openStock(stockOptionId) : null); setStockTab('add');
  }

  async function save() {
    if (!f) return;
    // ปุ่มไม่ล็อกเงียบ ๆ แล้ว: กดแล้วบอกว่ายังขาดอะไร
    const need = missing(f);
    if (need) { setMsg(`กรอกให้ครบก่อนบันทึก: ${need}`); notify(`กรอกให้ครบก่อนบันทึก: ${need}`, 'error'); return; }
    setBusy(true); setMsg('');
    const r = await api<{ id: string }>('/api/admin/products', { action: 'save', id: f.id, data: {
      name: f.name, category: f.category, description: f.description, image: f.image, template: f.template, fulfillment: f.fulfillment, badge: f.badge, ask_info: f.askInfo, active: f.active,
      preorder: f.fulfillment === 'stock' && f.preorder, preorder_note: f.preorderNote.trim(), preorder_limit: f.preorderLimit ? Number(f.preorderLimit) : null,
      options: f.options.map((o) => ({ id: o.id, name: o.name, price: Number(o.price), compare_at: num(o.compare_at), cost: num(o.cost), duration_days: num(o.duration_days), agent_price: num(o.agent_price), active: o.active })),
    } });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    // วิธีการใช้งาน: บันทึกแยก (ยังไม่รัน SQL 0011 = แจ้งเตือน แต่สินค้าบันทึกแล้ว)
    const pid = f.id ?? r.data.id;
    const same = (a: string[], b: string[]) => a.join('\n') === b.join('\n');
    const imgChanged = imgReady && !same(usageImgs, usageImages[pid ?? ''] ?? []);
    const galChanged = galleryReady && !same(gallery, images[pid ?? ''] ?? []);
    // วิธีใช้งาน + ปุ่มรับ OTP: บันทึกพร้อมกัน เฉพาะส่วนที่เปลี่ยน
    const extra: Promise<{ ok: boolean; error: string }>[] = [];
    if (pid && usageReady && (imgChanged || galChanged || usage.trim() !== (usages[pid] ?? '').trim())) {
      const media = galleryReady ? { usage_images: usageImgs, images: gallery } : imgReady ? { usage_image: usageImgs[0] ?? '' } : {};
      extra.push(api('/api/admin/products', { action: 'usage', id: pid, usage, ...media }));
    }
    if (pid && otp?.ready && otpApp !== (otp.picks[pid] ?? '')) extra.push(api('/api/admin/products', { action: 'otp', id: pid, app_id: otpApp || null }));
    if (extra.length) {
      setBusy(true);
      const bad = (await Promise.all(extra)).find((x) => !x.ok);
      setBusy(false);
      if (bad) { setMsg(bad.error); router.refresh(); return; }
    }
    setF(null); notify('บันทึกสินค้าแล้ว ✓'); router.refresh();
  }
  async function upload(fl: File | undefined) {
    if (!fl || !f) return;
    setBusy(true);
    const r = await uploadImage(fl, 800);
    setBusy(false);
    if (r.ok) setF({ ...f, image: r.data.url }); else setMsg(r.error);
  }
  async function simple(body: object, confirmText?: string) {
    if (confirmText && !(await ask(confirmText, { danger: true, ok: 'ลบ' }))) return;
    const r = await api<{ notice?: string }>('/api/admin/products', body);
    if (!r.ok) { notify(r.error, 'error'); return; }
    if (r.data.notice) notify(r.data.notice, 'info');
    router.refresh();
  }
  async function addStock() {
    if (!stock) return;
    setBusy(true);
    const text = stockText(fillStock(stock));
    if (!text.trim()) { setBusy(false); setMsg('ยังไม่ได้กรอกข้อมูล'); return; }
    // เมลรับ OTP: ตาราง = ทีละชิ้น (เฉพาะชิ้นที่กรอก ลำดับเดียวกับ fieldsToText) · ข้อความ = เมลเดียวทุกชิ้น
    const st = fillStock(stock);
    const otpMail = !otpApp ? {} : !st.shared && st.mode !== 'block'
      ? { otp_emails: st.rows.map((row, k) => [row, k] as const).filter(([row]) => row.some((v) => v.trim())).map(([, k]) => (st.otp[k] ?? '').trim()) }
      : { otp_email: st.otpAll.trim() };
    if (f?.id && otp?.ready && otpApp !== (otp.picks[f.id] ?? '')) {
      const o = await api('/api/admin/products', { action: 'otp', id: f.id, app_id: otpApp || null });
      if (!o.ok) { setBusy(false); setMsg(o.error); return; }
    }
    const r = await api<{ notice: string }>('/api/admin/products', { action: 'stock', optionId: stock.optionId, text, mode: 'block', plain: !!stock.shared || stock.mode !== 'fields', repeat: Math.min(500, Math.max(1, Number(stock.repeat) || 1)), ...otpMail });
    setBusy(false);
    setMsg(r.ok ? r.data.notice : r.error);
    if (r.ok) { setStock(null); router.refresh(); }
  }
  const setOpt = (i: number, patch: Partial<OptF>) => f && setF({ ...f, options: f.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const shown = products.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const live = products.filter((p) => p.active);

  return (
    <>
      <div className="page-head"><div><h1>สินค้า</h1><p>สินค้าและแพ็กเกจที่ขายในร้าน · กดแถวเพื่อแก้ไข</p></div>
        <div className="acts"><button type="button" className="btn primary" onClick={() => { setF(blank()); setUsage(''); setUsageImgs([]); setGallery([]); setOtpApp(''); setMsg(''); }}>+ เพิ่มสินค้า</button></div></div>
      <div className="kpis">
        <div className="card kpi"><span className="lbl">เปิดขาย</span><span className="val num">{live.length}</span><span className="delta mute">จาก {products.length} สินค้า</span></div>
        <div className="card kpi"><span className="lbl">ของหมด</span><span className="val num">{live.filter((p) => !p.inStock).length}</span><span className="delta mute">{live.filter((p) => !p.inStock).map((p) => p.name).slice(0, 2).join(', ') || 'ไม่มี 👍'}</span></div>
        <div className="card kpi"><span className="lbl">ขายแล้วทั้งหมด</span><span className="val num">{products.reduce((s, p) => s + p.sold, 0).toLocaleString('th-TH')}</span><span className="delta mute">ชิ้น</span></div>
        <div className="card kpi"><span className="lbl">ขายดีสุด</span><span className="val" style={{ fontSize: 20 }}>{[...products].sort((a, b) => b.sold - a.sold)[0]?.name ?? '—'}</span><span className="delta mute">{[...products].sort((a, b) => b.sold - a.sold)[0]?.sold ?? 0} ชิ้น</span></div>
      </div>
      <CategoriesCard categories={categories} counts={counts} />
      <section className="card">
        <div className="toolbar"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นหาสินค้า" /></div>
        {!products.length ? <div className="card-pad"><p className="muted" style={{ margin: 0 }}>ยังไม่มีสินค้า — กด &quot;+ เพิ่มสินค้า&quot; เพื่อเริ่มต้น</p></div> : (
          <table className="tbl ptbl">
            <thead><tr><th>สินค้า</th><th>วิธีส่งของ</th><th className="r">ราคา</th><th>สต็อก</th><th className="r">ขายแล้ว</th><th>เปิดขาย</th><th className="r">จัดการ</th></tr></thead>
            <tbody>{shown.map((p) => (
              <tr key={p.id} onClick={() => openProduct(p)} style={{ opacity: p.active ? 1 : .55 }}>
                <td className="m-full"><div className="prod"><AppLogo image={p.image} template={p.template} name={p.name} /><div><b>{p.name}</b><small>{p.options.filter((o) => o.active).map((o) => o.name).join(' · ') || 'ยังไม่มีแพ็กเกจ'}</small></div></div></td>
                <td className="m-hide"><span className="pill plain">{FULFILL_LABEL[p.fulfillment]}</span></td>
                <td className="r num">{p.from !== null ? baht(p.from) : '—'}</td>
                <td><div className="stockbar"><span className={`num${p.inStock ? '' : ' faint'}`}>{p.left === null ? 'ไม่จำกัด' : p.left ? `${p.left} ${p.fulfillment === 'slot' ? 'จอ' : 'ชิ้น'}` : 'หมด'}</span>{p.left !== null && <div className={`meter${p.left <= 3 ? ' warn' : ''}`}><i style={{ width: `${Math.min(100, p.left * 5)}%` }} /></div>}</div></td>
                <td className="r num m-hide">{p.sold.toLocaleString('th-TH')}</td>
                <td className="m-tog"><button type="button" className={`toggle${p.active ? ' on' : ''}`} aria-label="เปิด/ปิดขาย" onClick={(e) => { e.stopPropagation(); simple({ action: 'toggle', id: p.id, active: !p.active }); }} /></td>
                <td className="m-acts" onClick={(e) => e.stopPropagation()}><div className="row-acts">
                  {p.fulfillment === 'stock' && <button type="button" className="btn soft sm" onClick={() => openProduct(p, (p.options.find((o) => o.active) ?? p.options[0])?.id)}>+ เพิ่มสต็อก</button>}
                  <button type="button" className="btn sm" onClick={() => openProduct(p)}>แก้ไข</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <div className={`drawer-bg${f ? ' open' : ''}`} onClick={() => setF(null)} />
      <aside className={`drawer pe-full${f ? ' open' : ''}`} aria-hidden={!f}>
        {f && <>
          <div className="drawer-head"><b style={{ flex: 1, fontSize: 17 }}>{f.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</b><button type="button" className="icon-btn" onClick={() => setF(null)} aria-label="ปิด">✕</button></div>
          <div className="drawer-body">
            {editing && (() => {
              const priced = editing.options.some((x) => x.active && x.price > 0);
              const stocked = editing.fulfillment !== 'stock' || (editing.left ?? 0) > 0 || f.preorder;
              const checks: [boolean, string, boolean][] = [
                [priced, 'มีแพ็กเกจราคาที่เปิดขาย', false],
                [stocked, editing.fulfillment === 'stock' ? (editing.left ? `มีของพร้อมส่ง ${editing.left} ชิ้น` : f.preorder ? 'ของหมด แต่เปิดพรีออเดอร์ไว้' : 'มีของในสต็อก') : 'สั่งทำ ไม่ต้องมีสต็อก', !priced],
                [!!f.image, 'มีรูปสินค้า', true],
              ];
              const live = editing.active;
              return (
                <section className={dcss.status}>
                  <div className={dcss.stHead}>
                    <span className={`${dcss.dot}${live ? ` ${stocked ? dcss.ok : dcss.warn}` : ''}`} aria-hidden />
                    <div><b>{!live ? 'ฉบับร่าง' : stocked ? 'เปิดขายอยู่' : 'เปิดขาย · ของหมด'}</b>
                      <small className="muted">{!live ? 'ยังไม่แสดงในหน้าร้าน เตรียมให้ครบแล้วกดเปิดขาย' : stocked ? 'ลูกค้าเห็นและสั่งซื้อได้' : 'ลูกค้าเห็นแต่ซื้อไม่ได้ เติมสต็อกหรือเปิดพรีออเดอร์'}</small></div>
                    <button type="button" className={`btn sm ${live ? 'ghost' : 'primary'}`} disabled={busy || (!live && !priced)} title={!live && !priced ? 'ใส่ราคาแพ็กเกจแล้วกดบันทึกก่อน' : undefined}
                      onClick={async () => { const r = await api('/api/admin/products', { action: 'toggle', id: editing.id, active: !live }); if (!r.ok) { notify(r.error, 'error'); return; } setF({ ...f, active: !live }); notify(live ? 'ปิดขายแล้ว' : 'เปิดขายแล้ว ✓'); router.refresh(); }}>
                      {live ? 'ปิดขาย' : '🏪 เปิดขาย'}</button>
                  </div>
                  <ul className={dcss.checks}>{checks.map(([ok, l, soft], k) => <li key={k} className={ok ? dcss.ok : ''}><span aria-hidden>{ok ? '✓' : '○'}</span>{l}{!ok && soft && <small className="faint"> (แนะนำ)</small>}</li>)}</ul>
                </section>
              );
            })()}
            <div className="pe-col">
            <h3 className="pe-h">ข้อมูลสินค้า</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <AppLogo image={f.image} template={f.template} name={f.name || '?'} size="lg" />
              <div style={{ display: 'grid', gap: 6 }}>
                <button type="button" className="btn sm" onClick={() => file.current?.click()} disabled={busy}>{f.image ? 'เปลี่ยนรูป' : 'อัปโหลดรูปโลโก้'}</button>
                {f.image && <button type="button" className="btn ghost sm" onClick={() => setF({ ...f, image: '' })}>เอารูปออก</button>}
              </div>
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <div className="field"><span>รูปสินค้าเพิ่มเติม (ลูกค้าเห็นในหน้าสินค้า · ใส่กี่รูปก็ได้)</span>
              {galleryReady
                ? <ImageList urls={gallery} onChange={setGallery} max={MAX_IMAGES} disabled={busy} upload={uploadMany} addLabel="เพิ่มรูป" />
                : <small className="faint" style={{ fontSize: 12 }}>⚠️ ต้องรัน SQL 0029_product_images.sql ก่อน ถึงจะใส่รูปสินค้าได้หลายรูป</small>}
              {galleryReady && <small className="faint" style={{ fontSize: 12 }}>รูปบนสุด (โลโก้) ใช้ในการ์ดสินค้า · รูปเพิ่มเติมแสดงต่อท้ายในหน้าสินค้า · กด ‹ เพื่อเลื่อนลำดับ · 🗜️ ระบบย่อรูปให้อัตโนมัติก่อนอัป</small>}</div>
            <label className="field"><span>ชื่อสินค้า</span><input className="input" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="field"><span>หมวด</span>
                <select className="input" value={f.category} onChange={async (e) => {
                  if (e.target.value !== '__new') { setF({ ...f, category: e.target.value }); return; }
                  const n = await input('เพิ่มหมวดใหม่', { placeholder: 'เช่น ดูหนัง · เพลง · อนิเมะ', max: 30, ok: 'เพิ่มหมวด' });
                  if (n) setF({ ...f, category: n.slice(0, 30) });
                }}>
                  <option value="">— ไม่มีหมวด —</option>
                  {[...new Set([...categories, f.category].filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__new">+ หมวดใหม่…</option>
                </select></label>
              <label className="field"><span>ป้าย (ไม่บังคับ)</span><input className="input" value={f.badge} maxLength={16} placeholder="ขายดี / ใหม่" onChange={(e) => setF({ ...f, badge: e.target.value })} /></label>
            </div>
            <label className="field"><span>วิธีส่งของ</span>
              <select className="input" value={f.fulfillment} onChange={(e) => setF({ ...f, fulfillment: e.target.value as Form['fulfillment'] })} disabled={!!editing}>
                {/* ปิดการสร้างแบบแบ่งจอแล้ว · สินค้าแบ่งจอเดิมยังต้องแสดงค่าของมัน */}
                {f.fulfillment === 'slot' && <option value="slot">แบ่งจอ (ระบบเดิม เลิกใช้แล้ว)</option>}
                <option value="stock">ส่งอัตโนมัติ — เตรียมบัญชี / รหัสไว้ก่อน ลูกค้าจ่ายแล้วได้ของทันที</option>
                <option value="manual">สั่งทำ — ลูกค้าจ่ายแล้วรอร้านทำให้ ส่งของที่หน้าออเดอร์ (แท็บ รอส่ง)</option>
              </select>
</label>
            {f.fulfillment === 'stock' && (
              <div className="field preorder-box"><label className="preorder-on"><input type="checkbox" checked={f.preorder} onChange={(e) => setF({ ...f, preorder: e.target.checked })} /><span><b>📦 เปิดพรีออเดอร์เมื่อของหมด</b><small>ลูกค้าจองและจ่ายได้ตอนสต็อกเป็น 0 · เติมสต็อกเมื่อไหร่ ระบบส่งให้คนที่จองก่อนอัตโนมัติ</small></span></label>
                {f.preorder && <div className="two">
                  <input className="input" value={f.preorderNote} maxLength={80} placeholder="บอกลูกค้า เช่น ได้ของภายใน 1-2 วัน" aria-label="ข้อความพรีออเดอร์" onChange={(e) => setF({ ...f, preorderNote: e.target.value })} />
                  <input className="input" inputMode="numeric" value={f.preorderLimit} placeholder="รับจองสูงสุด (ว่าง = ไม่จำกัด)" aria-label="รับจองสูงสุด" onChange={(e) => setF({ ...f, preorderLimit: e.target.value.replace(/\D/g, '').slice(0, 5) })} />
                </div>}</div>
            )}
            <label className="field"><span>ขอข้อมูลจากลูกค้าตอนสั่ง (ไม่บังคับ)</span><input className="input" value={f.askInfo} maxLength={60} placeholder="เช่น อีเมลสำหรับเชิญเข้าครอบครัว" onChange={(e) => setF({ ...f, askInfo: e.target.value })} />
              <small className="faint" style={{ fontSize: 12 }}>ใส่หัวข้อแล้วลูกค้าต้องกรอกในตะกร้าก่อนจ่าย · ดูได้ในหน้าออเดอร์</small></label>
            <label className="field"><span>รายละเอียด (ลูกค้าเห็นก่อนซื้อ)</span><textarea className="input" rows={4} value={f.description} maxLength={3000} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
            <label className="field"><span>วิธีการใช้งาน (ลูกค้าเห็นหลังซื้อ คู่กับรหัส / ลิงก์ที่ได้)</span>
              <textarea className="input" rows={6} value={usage} maxLength={3000} disabled={!usageReady} onChange={(e) => setUsage(e.target.value)}
                placeholder={'เช่น\n1. นำลิงก์ไปเปิดผ่าน Google Chrome / Safari\n2. ล็อกอินด้วยเมลของลูกค้า แล้วกด "เข้าร่วมทีม"\n3. ไม่แจ้งเมล = ไม่รับเคลมทุกกรณี'} />
              <small className="faint" style={{ fontSize: 12 }}>{usageReady ? 'ใส่ครั้งเดียว ใช้กับทุกชิ้นของสินค้านี้ · ไม่ต้องพิมพ์ซ้ำในสต็อกทุกชิ้น' : '⚠️ ต้องรัน SQL 0011_product_usage.sql ก่อน'}</small></label>
            <div className="field"><span>รูปวิธีการใช้งาน (ลูกค้าดูและดาวน์โหลดได้หลังซื้อ{galleryReady ? ' · ใส่กี่รูปก็ได้' : ''})</span>
              <ImageList urls={usageImgs} onChange={setUsageImgs} max={galleryReady ? MAX_IMAGES : 1} disabled={busy || !imgReady} upload={uploadMany} addLabel="รูปวิธีใช้" />
              <small className="faint" style={{ fontSize: 12 }}>{!imgReady ? '⚠️ ต้องรัน SQL 0012_usage_image.sql ก่อน' : galleryReady ? 'เช่น รูปขั้นตอนการเข้าใช้ทีละขั้น / ภาพแคปหน้าจอ · ลูกค้าเห็นเรียงตามลำดับนี้' : '⚠️ ตอนนี้ใส่ได้ 1 รูป · รัน SQL 0029_product_images.sql เพื่อใส่ได้หลายรูป'}</small></div>
            </div>

            <div className="pe-col">
            <h3 className="pe-h">แพ็กเกจ · ราคา · สต็อก</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <span className="faint" style={{ fontSize: 12 }}>ราคาก่อนลด = ราคาเดิมที่โชว์ขีดฆ่าข้าง ๆ ราคาขาย (เช่น <s>฿129</s> ฿99) · ไม่ใส่ก็ได้</span>
              {f.options.map((o, i) => (
                <div key={i} className="card" style={{ padding: 10, display: 'grid', gap: 8, opacity: o.active ? 1 : .6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 8 }}>
                    <label className="field"><span>ชื่อแพ็กเกจ</span><input className="input" value={o.name} placeholder="เช่น 30 วัน" onChange={(e) => setOpt(i, { name: e.target.value })} /></label>
                    <label className="field"><span>ราคาขาย ฿</span><input className="input" value={o.price} placeholder="เช่น 99" inputMode="decimal" onChange={(e) => setOpt(i, { price: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                    <label className="field"><span>ราคาก่อนลด ฿</span><input className="input" value={o.compare_at} placeholder="ไม่บังคับ" inputMode="decimal" onChange={(e) => setOpt(i, { compare_at: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                    <label className="field"><span>ใช้ได้กี่วัน</span><input className="input" value={o.duration_days} placeholder="เช่น 30" inputMode="numeric" onChange={(e) => setOpt(i, { duration_days: e.target.value.replace(/\D/g, '') })} /></label>
                    <label className="field"><span>ต้นทุน ฿ (ร้านเห็นคนเดียว)</span><input className="input" value={o.cost} placeholder="ไม่บังคับ" inputMode="decimal" onChange={(e) => setOpt(i, { cost: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                    <button type="button" className="btn ghost sm" onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i) })} aria-label="ลบแพ็กเกจ">🗑</button>
                  </div>
                  {agentsOn && (
                    <label className="field agent-price"><span>🤝 ราคาตัวแทน ฿ <small className="faint">(ไม่ใส่ = ตัวแทนซื้อราคาปกติ)</small></span>
                      <input className="input" value={o.agent_price} placeholder={o.price ? `ต่ำกว่า ${o.price}` : 'ไม่บังคับ'} inputMode="decimal" onChange={(e) => setOpt(i, { agent_price: e.target.value.replace(/[^\d.]/g, '') })} />
                      {o.agent_price && o.price && Number(o.agent_price) >= Number(o.price) && <small style={{ color: 'var(--warn)' }}>ราคาตัวแทนต้องต่ำกว่าราคาขาย ไม่งั้นจะไม่ถูกใช้</small>}
                    </label>
                  )}
                  {editing && o.id && f.fulfillment === 'stock' && (
                    stock?.optionId === o.id ? (
                      <div ref={stockBox} style={{ display: 'grid', gap: 8 }}>
                        <div className={dcss.tabs} role="tablist">
                          <button type="button" role="tab" aria-selected={stockTab === 'add'} className={stockTab === 'add' ? dcss.on : ''} onClick={() => setStockTab('add')}>เติมสต็อก</button>
                          <button type="button" role="tab" aria-selected={stockTab === 'list'} className={stockTab === 'list' ? dcss.on : ''} onClick={() => setStockTab('list')}>รายการในสต็อก ({editing.options.find((x) => x.id === o.id)?.stock ?? 0})</button>
                          <button type="button" className={dcss.x} onClick={() => setStock(null)} aria-label="ปิดสต็อก">✕</button>
                        </div>
                        {stockTab === 'list' ? <StockList optionId={o.id} onChanged={() => router.refresh()} /> : <>
                        <div className={dcss.kinds} role="radiogroup" aria-label="ชนิดสต็อก">
                          {([[false, '🔑', '1 ชิ้นต่อ 1 คำสั่งซื้อ', 'โค้ดเกม · คีย์ · user:pass · แต่ละคนได้ไม่ซ้ำกัน หมดแล้วหมดเลย'], [true, '🔗', 'ใช้ร่วมกัน', 'ลิงก์ · ไฟล์ · Google Drive · ทุกคนได้ข้อมูลเดียวกัน ใส่ครั้งเดียว']] as const).map(([v, ic, l, d]) => (
                            <button key={String(v)} type="button" role="radio" aria-checked={!!stock.shared === v} className={!!stock.shared === v ? dcss.on : ''}
                              onClick={() => { if (!!stock.shared !== v) setStock({ ...fillStock(stock), shared: v, repeat: v ? '100' : '1', building: false }); }}>
                              <span className={dcss.ic}>{ic}</span><span><b>{l}</b><small>{d}</small></span>{!!stock.shared === v && <i aria-hidden>✓</i>}</button>
                          ))}
                        </div>
                        {!stock.shared && <div className={`stock-modes ${dcss.three}`} role="radiogroup" aria-label="รูปแบบข้อมูล">
                          {([['form', '🎨 ฟอร์มส่งของ', 'วางฟอร์มที่เคยส่ง · แตะคำที่เปลี่ยน · เติมแค่ค่า'], ['fields', '📋 แยกช่อง', 'อีเมล / รหัสผ่าน / โปรไฟล์ · 1 แถว = 1 ชิ้น'], ['block', '📄 ข้อความยาว', 'ลิงก์ทีม / ข้อความหลายบรรทัด · ทั้งก้อน = 1 ชิ้น']] as const).map(([k, l, d]) => (
                            <button key={k} type="button" role="radio" aria-checked={stock.mode === k} className={stock.mode === k ? 'on' : ''} onClick={() => {
                              if (stock.mode === k) return;
                              const fm = formMap[stock.optionId];
                              if (k === 'form') setStock(fm ? withForm(fillStock(stock), fm) : { ...fillStock(stock), mode: 'form', dform: null, building: true });
                              else setStock(fillStock({ ...stock, mode: k, dform: null, building: false, ...(stock.mode === 'form' ? { cols: [...DEFAULT_COLS], rows: [['', '', '']], otp: [] } : {}) }));
                            }}><b>{l}</b><small>{d}</small></button>
                          ))}
                        </div>}
                        {otp && (
                          <div className="otp-pick">
                            <label className="field"><span>🔐 ปุ่มรับรหัส OTP ของสินค้านี้ (ลูกค้าเห็นในหน้าประวัติการซื้อ)</span>
                              <select className="input" value={otpApp} disabled={!otp.ready || !otp.apps.length} onChange={(e) => setOtpApp(e.target.value)}>
                                <option value="">ปิด — ไม่แสดงปุ่ม</option>
                                {otp.apps.map((a) => <option key={a.id} value={a.id}>เปิด — ค้นรหัสของ {a.name}</option>)}
                              </select></label>
                            <small className="faint">{!otp.ready ? '⚠️ ต้องรัน SQL 0032_product_otp_button.sql ก่อน' : !otp.apps.length ? 'เพิ่มแอปในหน้า "ค้นหา OTP" ก่อน แล้วค่อยเลือกที่นี่' : otpApp ? 'ใส่ 📧 เมลรับ OTP ในแต่ละชิ้นด้านล่าง · ชิ้นที่ใส่ = ลูกค้าที่ได้ชิ้นนั้นเห็นปุ่ม (ค้นได้เฉพาะเมลนั้น และสินค้าที่ยังไม่หมดอายุ)' : 'เลือกแอปเพื่อเปิดปุ่ม แล้วจะมีช่อง 📧 เมลรับ OTP ให้ใส่ทีละชิ้น'}</small>
                          </div>
                        )}
                        {!stock.shared && stock.mode === 'fields' && <StockTable st={fillStock(stock)} set={setStock} otpOn={!!otpApp} />}
                        {!stock.shared && stock.mode === 'form' && (stock.building || !stock.dform
                          ? <FormBuilder initial={stock.dform ?? null} busy={busy} onSave={saveForm} onCancel={() => setStock(stock.dform ? { ...stock, building: false } : fillStock({ ...stock, mode: 'fields', building: false }))} />
                          : <>
                            <div className={dcss.formbar}><small><b>🎨 ฟอร์มส่งของ</b> · {stock.dform.fields.length} ช่อง: {stock.dform.fields.join(' · ')}</small>
                              <button type="button" className="btn ghost sm" onClick={() => setStock({ ...stock, building: true })}>✏️ แก้ฟอร์ม</button></div>
                            <StockTable st={fillStock(stock)} set={setStock} otpOn={!!otpApp} locked />
                          </>)}
                        {stock.shared && <label className="field"><span>ข้อมูลที่ส่งให้ลูกค้าทุกคน</span>
                          <textarea className="input" rows={6} value={stock.text} onChange={(e) => setStock({ ...stock, text: e.target.value })} placeholder={'เช่น ลิงก์ Google Drive / ลิงก์ดาวน์โหลด / ลิงก์เข้ากลุ่ม\nhttps://drive.google.com/...'} /></label>}
                        {!stock.shared && stock.mode === 'block' && <textarea className="input" rows={10} value={stock.text} onChange={(e) => setStock({ ...stock, text: e.target.value })}
                          placeholder={'วางข้อความทั้งก้อน = 1 ชิ้น เช่น\n🔗 Link เข้าร่วมทีม: https://...\n👥 Team: ...\n⏰ วันหมดอายุ: ...\n\n(จะเพิ่มหลายชิ้นในครั้งเดียว คั่นแต่ละชิ้นด้วยบรรทัด ---)'} />}
                        <div className={dcss.rep}>
                          <span>👥 {stock.shared ? 'ขายได้' : '1 ชิ้นขายได้'}</span>
                          <button type="button" className="btn sm" aria-label="ลด" onClick={() => setStock({ ...stock, repeat: String(Math.max(1, (Number(stock.repeat) || 1) - 1)) })}>−</button>
                          <input className="input" inputMode="numeric" value={stock.repeat} aria-label="จำนวนคน" onChange={(e) => setStock({ ...stock, repeat: String(Math.min(500, Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 0) || '') })} onBlur={() => !Number(stock.repeat) && setStock({ ...stock, repeat: '1' })} />
                          <button type="button" className="btn sm" aria-label="เพิ่ม" onClick={() => setStock({ ...stock, repeat: String(Math.min(500, (Number(stock.repeat) || 1) + 1)) })}>+</button>
                          <span>คน</span>
                          <small className="faint">{stock.shared ? 'ครบแล้วของหมด เติมเพิ่มได้ (สูงสุดครั้งละ 500)' : 'เช่น ลิงก์ทีม / บัญชีแชร์ที่รับได้หลายคน'}</small>
                        </div>
                        {(stock.shared || stock.mode === 'block') && otpApp && (
                          <label className="field"><span>📧 เมลรับ OTP (ไม่บังคับ · ใช้กับทุกชิ้นที่เพิ่มครั้งนี้)</span>
                            <input className="input" type="email" value={fillStock(stock).otpAll} placeholder="เช่น netflix01@gmail.com · เว้นว่าง = ไม่มีปุ่มรับ OTP" onChange={(e) => setStock({ ...fillStock(stock), otpAll: e.target.value })} /></label>
                        )}
                        <small className="faint">{stockCount(stock)}</small>
                        {(() => { const pv = previewOf(stock); return pv ? (
                          <div className="stock-preview"><span className="pe-sub">👀 ตัวอย่างที่ลูกค้าเห็น (ชิ้นแรก)</span><Delivered content={pv} warranty={o.duration_days ? `${o.duration_days} วันหลังซื้อ` : null} /></div>
                        ) : null; })()}
                        <div style={{ display: 'flex', gap: 6 }}><button type="button" className="btn primary sm" disabled={busy || !stockText(fillStock(stock)).trim() || (!stock.shared && stock.mode === 'form' && !!stock.building)} onClick={addStock}>เพิ่มสต็อก</button><button type="button" className="btn ghost sm" onClick={() => setStock(null)}>ยกเลิก</button></div>
                        </>}
                      </div>
                    ) : <button type="button" className="btn soft sm" onClick={() => { setStock(openStock(o.id!)); setStockTab('add'); }}>+ เพิ่มสต็อก (เหลือ {editing.options.find((x) => x.id === o.id)?.stock ?? 0})</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn sm" onClick={() => setF({ ...f, options: [...f.options, { name: '', price: '', compare_at: '', cost: '', duration_days: '', agent_price: '', active: true }] })}>+ เพิ่มแพ็กเกจ</button>
            </div>
            {msg && <p style={{ color: msg.startsWith('เพิ่มสต็อก') ? 'var(--ok)' : 'var(--bad)', margin: 0 }} role="alert">{msg}</p>}
            </div>
          </div>
          <div className="drawer-foot">
            {f.id && <button type="button" className="btn danger" onClick={() => { simple({ action: 'delete', id: f.id }, `ลบสินค้า "${f.name}"?`); setF(null); }}>ลบ</button>}
            {missing(f) && !busy && <small style={{ flex: 2, alignSelf: 'center', color: 'var(--bad)', fontSize: 13 }}>ยังขาด: {missing(f)}</small>}
            <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          </div>
        </>}
      </aside>
    </>
  );
}

/** เพิ่มสต็อกแบบแยกช่อง (แนวตั้ง): ตั้งชื่อช่องครั้งเดียวด้านบน · 1 การ์ด = 1 ชิ้น ช่องเรียงลงมา · วาง "a | b | c" หลายบรรทัดได้ */
const MAX_IMAGES = 20;

/** รูปหลายรูป: ตัวอย่างย่อ · ลบ · เลื่อนลำดับ · เลือกหลายไฟล์พร้อมกันได้ */
function ImageList({ urls, onChange, max, disabled, upload, addLabel }: { urls: string[]; onChange: (u: string[]) => void; max: number; disabled: boolean; upload: (f: File[]) => Promise<string[]>; addLabel: string }) {
  const pickRef = useRef<HTMLInputElement>(null);
  const move = (i: number) => { const a = [...urls]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); };
  return (
    <div className="imgs">
      {urls.map((u, i) => (
        <div key={`${u}${i}`} className="imgs-item">
          <img src={u} alt={`${addLabel} ที่ ${i + 1}`} loading="lazy" />
          <button type="button" className="imgs-x" aria-label={`ลบ${addLabel}ที่ ${i + 1}`} onClick={() => onChange(urls.filter((_, k) => k !== i))}>✕</button>
          {i > 0 && <button type="button" className="imgs-left" aria-label={`เลื่อน${addLabel}ที่ ${i + 1} ขึ้นก่อน`} onClick={() => move(i)}>‹</button>}
        </div>
      ))}
      {urls.length < max && <button type="button" className="imgs-add" disabled={disabled} onClick={() => pickRef.current?.click()}>＋<span>{addLabel}</span></button>}
      <input ref={pickRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={max > 1} hidden onChange={async (e) => {
        const files = [...(e.target.files ?? [])].slice(0, max - urls.length);
        e.target.value = '';
        const got = await upload(files);
        if (got.length) onChange([...urls, ...got]);
      }} />
    </div>
  );
}

function StockTable({ st, set, otpOn, locked = false }: { st: StockForm; set: (s: StockForm) => void; otpOn: boolean; locked?: boolean }) {
  const setCell = (r: number, c: number, v: string) => set({ ...st, rows: st.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) });
  function paste(e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) {
    const t = e.clipboardData.getData('text').replace(/\r\n/g, '\n').trim();
    if (!t.includes('\n') && !t.includes('\t') && !t.includes('|')) return; // ค่าเดียว = วางปกติ
    e.preventDefault();
    const lines = t.split('\n').filter((l) => l.trim()).map((l) => l.split(/\t|\s*\|\s*/));
    const rows = st.rows.map((x) => [...x]);
    lines.forEach((cells, i) => {
      const ri = r + i;
      if (!rows[ri]) rows[ri] = st.cols.map(() => '');
      cells.forEach((v, j) => { if (c + j < st.cols.length) rows[ri][c + j] = v.trim(); });
    });
    set({ ...st, rows });
  }
  return (
    <div className="sv">
      {/* ชื่อช่อง (ใช้กับทุกชิ้น) · ฟอร์มส่งของ = ช่องมาจากฟอร์ม แก้ที่ปุ่ม "แก้ฟอร์ม" */}
      {!locked && <div className="sv-cols">
        <span className="pe-sub">ช่องข้อมูลของแต่ละชิ้น</span>
        <div className="sv-chips">
          {st.cols.map((c, j) => (
            <span key={j} className="sv-chip">
              <input value={c} maxLength={30} size={Math.max(4, c.length)} aria-label={`ชื่อช่องที่ ${j + 1}`} onChange={(e) => set({ ...st, cols: st.cols.map((x, k) => (k === j ? e.target.value : x)) })} />
              {st.cols.length > 1 && <button type="button" title="ลบช่องนี้" onClick={() => set({ ...st, cols: st.cols.filter((_, k) => k !== j), rows: st.rows.map((row) => row.filter((_, k) => k !== j)) })}>✕</button>}
            </span>
          ))}
          {st.cols.length < 6 && <button type="button" className="sv-add" onClick={() => set({ ...st, cols: [...st.cols, `ช่อง ${st.cols.length + 1}`], rows: st.rows.map((row) => [...row, '']) })}>＋ เพิ่มช่อง</button>}
        </div>
      </div>}

      {/* 1 การ์ด = 1 ชิ้น */}
      {st.rows.map((row, i) => (
        <div key={i} className="sv-item">
          <div className="sv-item-head"><b>ชิ้นที่ {i + 1}</b>
            {st.rows.length > 1 && <button type="button" className="btn ghost sm" onClick={() => set({ ...st, rows: st.rows.filter((_, k) => k !== i), otp: st.otp.filter((_, k) => k !== i) })}>🗑 ลบชิ้นนี้</button>}</div>
          {st.cols.map((c, j) => (
            <label key={j} className="field sv-field"><span>{c || `ช่อง ${j + 1}`}</span>
              <input className="input" value={row[j] ?? ''} placeholder={`ใส่${c || 'ข้อมูล'}`} onChange={(e) => setCell(i, j, e.target.value)} onPaste={(e) => paste(e, i, j)} /></label>
          ))}
          {/* เมลรับ OTP ของชิ้นนี้ (ร้านเปิดปุ่มรับ OTP ที่สินค้า) — ลูกค้าที่ได้ชิ้นนี้เห็นปุ่ม และค้นรหัสได้เฉพาะเมลนี้ */}
          {otpOn && (
            <label className="field sv-field"><span>📧 เมลรับ OTP (ไม่บังคับ)</span>
              <input className="input" type="email" value={st.otp[i] ?? ''} placeholder="เว้นว่าง = ชิ้นนี้ไม่มีปุ่มรับ OTP"
                onChange={(e) => { const otp = [...st.otp]; otp[i] = e.target.value; set({ ...st, otp }); }} /></label>
          )}
        </div>
      ))}

      <button type="button" className="btn sv-more" onClick={() => set({ ...st, rows: [...st.rows, st.cols.map(() => '')] })}>＋ เพิ่มอีกชิ้น</button>
      <small className="faint">มีหลายชิ้น? วาง <code>{locked ? st.cols.join(' | ') : 'อีเมล | รหัส | โปรไฟล์'}</code> หลายบรรทัด (หรือก๊อปจาก Excel) ลงช่องแรกของชิ้นที่ 1 ระบบแยกเป็นหลายชิ้นให้เอง</small>
    </div>
  );
}
