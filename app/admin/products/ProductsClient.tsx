'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { to } from '@/lib/routes';
import { ask, input, notify } from '@/components/dialog';
import { api, baht } from '@/components/Cart';
import { AppLogo } from '@/components/AppLogo';
import { FULFILL_LABEL, TEMPLATES, templateOf } from '@/lib/templates';
import type { Product } from '@/lib/catalog';
import { CategoriesCard } from './CategoriesCard';
import { Delivered } from '@/components/Delivered';
import { markPlain } from '@/lib/fields';

type OptF = { id?: string; name: string; price: string; compare_at: string; cost: string; duration_days: string; agent_price: string; active: boolean };
type Form = { id?: string; name: string; category: string; description: string; image: string; template: string; fulfillment: 'stock' | 'slot' | 'manual'; badge: string; askInfo: string; active: boolean; options: OptF[] };
const num = (s: string) => (s.trim() === '' ? null : Number(s));
type StockForm = { optionId: string; mode: 'fields' | 'block'; text: string; repeat: string; cols: string[]; rows: string[][] };
const DEFAULT_COLS = ['อีเมล', 'รหัสผ่าน', 'โปรไฟล์'];
const newStock = (optionId: string): StockForm => ({ optionId, mode: 'fields', text: '', repeat: '1', cols: [...DEFAULT_COLS], rows: [['', '', '']] });
/** เติมค่าที่ขาด (เช่น state เก่าจากก่อนอัปเดตหน้า ที่ยังไม่มีตาราง) */
const fillStock = (st: Partial<StockForm> & { optionId: string }): StockForm => {
  const base = newStock(st.optionId);
  const cols = st.cols?.length ? st.cols : base.cols;
  const rows = st.rows?.length ? st.rows : [cols.map(() => '')];
  return { ...base, ...st, cols, rows, text: st.text ?? '', repeat: st.repeat ?? '1' };
};
/** ตาราง → ชิ้นละหลายบรรทัด "หัวข้อ: ค่า" คั่นชิ้นด้วย --- (ลูกค้าเห็นแยกช่อง + ปุ่มคัดลอก) */
function fieldsToText(st: StockForm) {
  const cols = st.cols ?? [];
  return (st.rows ?? [])
    .map((r) => cols.map((c, i) => (r[i]?.trim() ? `${c.trim() || `ข้อมูล ${i + 1}`}: ${r[i].trim()}` : '')).filter(Boolean).join('\n'))
    .filter(Boolean).join('\n---\n');
}
/** ข้อความชิ้นแรก (ไว้โชว์ตัวอย่างว่าลูกค้าจะเห็นยังไง) */
function previewOf(st: StockForm): string {
  if (st.mode === 'fields') return fieldsToText(st).split('\n---\n')[0] ?? '';
  const t = (st.text ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return '';
  return markPlain((t.split(/^\s*-{3,}\s*$/m).find((s) => s.trim()) ?? '').replace(/^\n+|\s+$/g, ''));
}
/** นับจำนวนชิ้นที่จะเพิ่ม (ให้ตรงกับที่เซิร์ฟเวอร์แยก) */
function stockCount(st: StockForm) {
  if (st.mode === 'fields') { const n = (st.rows ?? []).filter((r) => r.some((v) => v.trim())).length; return n ? `จะเพิ่ม ${n} ชิ้น` : 'ยังไม่ได้กรอกข้อมูล'; }
  const t = (st.text ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return 'ยังไม่มีข้อความ';
  const n = new Set(t.split(/^\s*-{3,}\s*$/m).map((s) => s.replace(/^\n+|\s+$/g, '')).filter((s) => s.trim())).size * Math.max(1, Number(st.repeat) || 1);
  return `จะเพิ่ม ${n.toLocaleString('th-TH')} ชิ้น`;
}
const blank = (): Form => ({ name: '', category: '', description: '', image: '', template: '', fulfillment: 'stock', badge: '', askInfo: '', active: true, options: [{ name: '30 วัน', price: '', compare_at: '', cost: '', duration_days: '30', agent_price: '', active: true }] });
const fromProduct = (p: Product, ap: Record<string, number> = {}): Form => ({
  id: p.id, name: p.name, category: p.category, description: p.description, image: p.image, template: p.template, fulfillment: p.fulfillment, badge: p.badge, askInfo: p.askInfo, active: p.active,
  options: p.options.map((o) => ({ id: o.id, name: o.name, price: String(o.price), compare_at: o.compareAt?.toString() ?? '', cost: o.cost?.toString() ?? '', duration_days: o.durationDays?.toString() ?? '', agent_price: ap[o.id]?.toString() ?? '', active: o.active })),
});

/** สินค้า: ตาราง + เพิ่มจากแม่แบบ + แผงแก้ไข (ข้อมูล · แพ็กเกจ · สต็อก) */
export function ProductsClient({ products, categories, usages, usageReady, usageImages, imgReady, agentPrices, agentsOn }: { products: Product[]; categories: string[]; usages: Record<string, string>; usageReady: boolean; usageImages: Record<string, string>; imgReady: boolean; agentPrices: Record<string, number>; agentsOn: boolean }) {
  const [usage, setUsage] = useState('');
  const [usageImg, setUsageImg] = useState('');
  const usageFile = useRef<HTMLInputElement>(null);
  async function uploadUsage(fl?: File) {
    if (!fl) return;
    const fd = new FormData(); fd.append('file', fl);
    setBusy(true);
    const r = await api<{ url: string }>('/api/admin/upload', fd);
    setBusy(false);
    if (r.ok) setUsageImg(r.data.url); else setMsg(r.error);
  }
  const counts = products.reduce<Record<string, number>>((m, p) => ({ ...m, [p.category]: (m[p.category] ?? 0) + 1 }), {});
  const router = useRouter();
  const [f, setF] = useState<Form | null>(null);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [stock, setStock] = useState<StockForm | null>(null);
  const [q, setQ] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const editing = f?.id ? products.find((p) => p.id === f.id) : undefined;
  const stockBox = useRef<HTMLDivElement>(null);
  // เปิดฟอร์มเพิ่มสต็อกแล้วเลื่อนไปหา (แพ็กเกจอาจอยู่นอกจอ โดยเฉพาะบนมือถือ)
  useEffect(() => { if (stock?.optionId) stockBox.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [stock?.optionId]);

  /** เปิดแผงแก้ไข · ส่ง optionId มา = เปิดฟอร์มเพิ่มสต็อกของแพ็กเกจนั้นให้เลย */
  function openProduct(p: Product, stockOptionId?: string) {
    setF(fromProduct(p, agentPrices)); setUsage(usages[p.id] ?? ''); setUsageImg(usageImages[p.id] ?? ''); setMsg('');
    setStock(stockOptionId ? newStock(stockOptionId) : null);
  }

  function fromTemplate(key: string) {
    const t = templateOf(key)!;
    setF({ ...blank(), name: t.name, category: t.category, description: t.description, template: t.key, fulfillment: 'slot',
      options: t.plans.map(([n, price, days]) => ({ name: n, price: String(price), compare_at: '', cost: '', duration_days: String(days), agent_price: '', active: true })) });
    setPick(false); setMsg(''); setUsage(''); setUsageImg('');
  }
  async function save() {
    if (!f) return;
    setBusy(true); setMsg('');
    const r = await api<{ id: string }>('/api/admin/products', { action: 'save', id: f.id, data: {
      name: f.name, category: f.category, description: f.description, image: f.image, template: f.template, fulfillment: f.fulfillment, badge: f.badge, ask_info: f.askInfo, active: f.active,
      options: f.options.map((o) => ({ id: o.id, name: o.name, price: Number(o.price), compare_at: num(o.compare_at), cost: num(o.cost), duration_days: num(o.duration_days), agent_price: num(o.agent_price), active: o.active })),
    } });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    // วิธีการใช้งาน: บันทึกแยก (ยังไม่รัน SQL 0011 = แจ้งเตือน แต่สินค้าบันทึกแล้ว)
    const pid = f.id ?? r.data.id;
    const imgChanged = imgReady && usageImg !== (usageImages[pid ?? ''] ?? '');
    if (pid && usageReady && (imgChanged || usage.trim() !== (usages[pid] ?? '').trim())) {
      const u = await api('/api/admin/products', { action: 'usage', id: pid, usage, ...(imgReady ? { usage_image: usageImg } : {}) });
      if (!u.ok) { setMsg(u.error); router.refresh(); return; }
    }
    setF(null); router.refresh();
  }
  async function upload(fl: File | undefined) {
    if (!fl || !f) return;
    const fd = new FormData(); fd.append('file', fl);
    setBusy(true);
    const r = await api<{ url: string }>('/api/admin/upload', fd);
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
    const text = stock.mode === 'fields' ? fieldsToText(stock) : stock.text;
    if (!text.trim()) { setBusy(false); setMsg('ยังไม่ได้กรอกข้อมูล'); return; }
    const r = await api<{ notice: string }>('/api/admin/products', { action: 'stock', optionId: stock.optionId, text, mode: 'block', plain: stock.mode === 'block', repeat: stock.mode === 'block' ? Math.max(1, Number(stock.repeat) || 1) : 1 });
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
        <div className="acts"><button type="button" className="btn" onClick={() => setPick(true)}>ระบบแบ่งจอ</button><button type="button" className="btn primary" onClick={() => { setF(blank()); setUsage(''); setUsageImg(''); setMsg(''); }}>+ เพิ่มสินค้า</button></div></div>
      <div className="kpis">
        <div className="card kpi"><span className="lbl">เปิดขาย</span><span className="val num">{live.length}</span><span className="delta mute">จาก {products.length} สินค้า</span></div>
        <div className="card kpi"><span className="lbl">ของหมด</span><span className="val num">{live.filter((p) => !p.inStock).length}</span><span className="delta mute">{live.filter((p) => !p.inStock).map((p) => p.name).slice(0, 2).join(', ') || 'ไม่มี 👍'}</span></div>
        <div className="card kpi"><span className="lbl">ขายแล้วทั้งหมด</span><span className="val num">{products.reduce((s, p) => s + p.sold, 0).toLocaleString('th-TH')}</span><span className="delta mute">ชิ้น</span></div>
        <div className="card kpi"><span className="lbl">ขายดีสุด</span><span className="val" style={{ fontSize: 20 }}>{[...products].sort((a, b) => b.sold - a.sold)[0]?.name ?? '—'}</span><span className="delta mute">{[...products].sort((a, b) => b.sold - a.sold)[0]?.sold ?? 0} ชิ้น</span></div>
      </div>
      <CategoriesCard categories={categories} counts={counts} />
      <section className="card">
        <div className="toolbar"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นหาสินค้า" /></div>
        {!products.length ? <div className="card-pad"><p className="muted" style={{ margin: 0 }}>ยังไม่มีสินค้า — กด &quot;ระบบแบ่งจอ&quot; หรือ &quot;+ เพิ่มสินค้า&quot; เพื่อเริ่มต้น</p></div> : (
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
                  {p.fulfillment === 'slot' && <Link href={to(`/admin/accounts?p=${p.id}`)} className="btn soft sm">+ เพิ่มสต็อก</Link>}
                  {p.fulfillment === 'stock' && <button type="button" className="btn soft sm" onClick={() => openProduct(p, (p.options.find((o) => o.active) ?? p.options[0])?.id)}>+ เพิ่มสต็อก</button>}
                  <button type="button" className="btn sm" onClick={() => openProduct(p)}>แก้ไข</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      {pick && (
        <div className="cmd-bg open" onClick={(e) => { if (e.target === e.currentTarget) setPick(false); }}>
          <div className="card cmd" role="dialog" aria-label="ระบบแบ่งจอ เลือกแอป" style={{ padding: 18 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>ระบบแบ่งจอ · เลือกแอป</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {TEMPLATES.map((t) => (
                <button key={t.key} type="button" className="btn" style={{ height: 'auto', padding: 12, flexDirection: 'column', gap: 6 }} onClick={() => fromTemplate(t.key)}>
                  <AppLogo template={t.key} name={t.name} /><b style={{ fontSize: 13 }}>{t.name}</b>
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>เลือกแล้วแก้ชื่อ ราคา และรายละเอียดได้ทั้งหมด · อัปโหลดรูปโลโก้จริงได้</p>
          </div>
        </div>
      )}

      <div className={`drawer-bg${f ? ' open' : ''}`} onClick={() => setF(null)} />
      <aside className={`drawer pe-full${f ? ' open' : ''}`} aria-hidden={!f}>
        {f && <>
          <div className="drawer-head"><b style={{ flex: 1, fontSize: 17 }}>{f.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</b><button type="button" className="icon-btn" onClick={() => setF(null)} aria-label="ปิด">✕</button></div>
          <div className="drawer-body">
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
                {/* แบ่งจอสร้างจากแม่แบบเท่านั้น · สินค้าแบ่งจอเดิมยังต้องแสดงค่าของมัน */}
                {(f.template || f.fulfillment === 'slot') && <option value="slot">แบ่งจอ — เพิ่มบัญชีหลักที่เมนู &quot;คลังบัญชี&quot; ระบบจัดจอให้เอง</option>}
                <option value="stock">ส่งอัตโนมัติ — เตรียมบัญชี / รหัสไว้ก่อน ลูกค้าจ่ายแล้วได้ของทันที</option>
                <option value="manual">สั่งทำ — ลูกค้าจ่ายแล้วรอร้านทำให้ ส่งของที่หน้าออเดอร์ (แท็บ รอส่ง)</option>
              </select>
              {!f.id && !f.template && <small className="faint" style={{ fontSize: 12 }}>ต้องการขายแบบแบ่งจอ ให้ปิดหน้านี้แล้วกด &quot;ระบบแบ่งจอ&quot;</small>}</label>
            <label className="field"><span>ขอข้อมูลจากลูกค้าตอนสั่ง (ไม่บังคับ)</span><input className="input" value={f.askInfo} maxLength={60} placeholder="เช่น อีเมลสำหรับเชิญเข้าครอบครัว" onChange={(e) => setF({ ...f, askInfo: e.target.value })} />
              <small className="faint" style={{ fontSize: 12 }}>ใส่หัวข้อแล้วลูกค้าต้องกรอกในตะกร้าก่อนจ่าย · ดูได้ในหน้าออเดอร์</small></label>
            <label className="field"><span>รายละเอียด (ลูกค้าเห็นก่อนซื้อ)</span><textarea className="input" rows={4} value={f.description} maxLength={3000} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
            <label className="field"><span>วิธีการใช้งาน (ลูกค้าเห็นหลังซื้อ คู่กับรหัส / ลิงก์ที่ได้)</span>
              <textarea className="input" rows={6} value={usage} maxLength={3000} disabled={!usageReady} onChange={(e) => setUsage(e.target.value)}
                placeholder={'เช่น\n1. นำลิงก์ไปเปิดผ่าน Google Chrome / Safari\n2. ล็อกอินด้วยเมลของลูกค้า แล้วกด "เข้าร่วมทีม"\n3. ไม่แจ้งเมล = ไม่รับเคลมทุกกรณี'} />
              <small className="faint" style={{ fontSize: 12 }}>{usageReady ? 'ใส่ครั้งเดียว ใช้กับทุกชิ้นของสินค้านี้ · ไม่ต้องพิมพ์ซ้ำในสต็อกทุกชิ้น' : '⚠️ ต้องรัน SQL 0011_product_usage.sql ก่อน'}</small></label>
            <div className="field"><span>รูปวิธีการใช้งาน (ลูกค้าดูและดาวน์โหลดได้หลังซื้อ)</span>
              <input ref={usageFile} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { uploadUsage(e.target.files?.[0]); e.target.value = ''; }} />
              {usageImg && <img src={usageImg} alt="รูปวิธีการใช้งาน" className="usage-thumb" />}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn sm" disabled={busy || !imgReady} onClick={() => usageFile.current?.click()}>{usageImg ? 'เปลี่ยนรูป' : '🖼 อัปโหลดรูปวิธีใช้'}</button>
                {usageImg && <button type="button" className="btn ghost sm" onClick={() => setUsageImg('')}>เอารูปออก</button>}
              </div>
              <small className="faint" style={{ fontSize: 12 }}>{imgReady ? 'เช่น รูปขั้นตอนการเข้าใช้ / ภาพแคปหน้าจอ · ใส่คู่กับข้อความ หรือรูปอย่างเดียวก็ได้' : '⚠️ ต้องรัน SQL 0012_usage_image.sql ก่อน'}</small></div>
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
                      <div ref={stockBox} style={{ display: 'grid', gap: 6 }}>
                        <div className="stock-modes" role="radiogroup" aria-label="รูปแบบสต็อก">
                          {([['fields', '📋 แยกช่อง', 'อีเมล / รหัสผ่าน / โปรไฟล์ · 1 แถว = 1 ชิ้น'], ['block', '📄 ข้อความยาว', 'ลิงก์ทีม / ข้อความหลายบรรทัด · ทั้งก้อน = 1 ชิ้น']] as const).map(([k, l, d]) => (
                            <button key={k} type="button" role="radio" aria-checked={stock.mode === k} className={stock.mode === k ? 'on' : ''} onClick={() => setStock(fillStock({ ...stock, mode: k }))}><b>{l}</b><small>{d}</small></button>
                          ))}
                        </div>
                        {stock.mode === 'fields' && <StockTable st={fillStock(stock)} set={setStock} />}
                        {stock.mode === 'block' && <textarea className="input" rows={10} value={stock.text} onChange={(e) => setStock({ ...stock, text: e.target.value })}
                          placeholder={'วางข้อความทั้งก้อน = 1 ชิ้น เช่น\n🔗 Link เข้าร่วมทีม: https://...\n👥 Team: ...\n⏰ วันหมดอายุ: ...\n\n(จะเพิ่มหลายชิ้นในครั้งเดียว คั่นแต่ละชิ้นด้วยบรรทัด ---)'} />}
                        {stock.mode === 'block' && (
                          <label className="field" style={{ maxWidth: 300 }}><span>เพิ่มชิ้นนี้ซ้ำกี่ชิ้น (เช่น ลิงก์ทีมรับได้ 5 คน = 5)</span>
                            <input className="input" inputMode="numeric" value={stock.repeat} onChange={(e) => setStock({ ...stock, repeat: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></label>
                        )}
                        <small className="faint">{stockCount(stock)}</small>
                        {(() => { const pv = previewOf(stock); return pv ? (
                          <div className="stock-preview"><span className="pe-sub">👀 ตัวอย่างที่ลูกค้าเห็น (ชิ้นแรก)</span><Delivered content={pv} warranty={o.duration_days ? `${o.duration_days} วันหลังซื้อ` : null} /></div>
                        ) : null; })()}
                        <div style={{ display: 'flex', gap: 6 }}><button type="button" className="btn primary sm" disabled={busy || (stock.mode === 'fields' ? !fieldsToText(stock) : !stock.text.trim())} onClick={addStock}>เพิ่มสต็อก</button><button type="button" className="btn ghost sm" onClick={() => setStock(null)}>ยกเลิก</button></div>
                      </div>
                    ) : <button type="button" className="btn soft sm" onClick={() => setStock(newStock(o.id!))}>+ เพิ่มสต็อก (เหลือ {editing.options.find((x) => x.id === o.id)?.stock ?? 0})</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn sm" onClick={() => setF({ ...f, options: [...f.options, { name: '', price: '', compare_at: '', cost: '', duration_days: '', agent_price: '', active: true }] })}>+ เพิ่มแพ็กเกจ</button>
            </div>
            {f.fulfillment === 'slot' && <p className="muted" style={{ fontSize: 13, margin: 0 }}>💡 บันทึกแล้วไปที่เมนู <b>คลังบัญชี</b> เพื่อเพิ่มบัญชีหลัก + จอ</p>}
            {msg && <p style={{ color: msg.startsWith('เพิ่มสต็อก') ? 'var(--ok)' : 'var(--bad)', margin: 0 }} role="alert">{msg}</p>}
            </div>
          </div>
          <div className="drawer-foot">
            {f.id && <button type="button" className="btn danger" onClick={() => { simple({ action: 'delete', id: f.id }, `ลบสินค้า "${f.name}"?`); setF(null); }}>ลบ</button>}
            <button type="button" className="btn primary" disabled={busy || !f.name.trim() || !f.options.length} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          </div>
        </>}
      </aside>
    </>
  );
}

/** เพิ่มสต็อกแบบแยกช่อง (แนวตั้ง): ตั้งชื่อช่องครั้งเดียวด้านบน · 1 การ์ด = 1 ชิ้น ช่องเรียงลงมา · วาง "a | b | c" หลายบรรทัดได้ */
function StockTable({ st, set }: { st: StockForm; set: (s: StockForm) => void }) {
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
      {/* ชื่อช่อง (ใช้กับทุกชิ้น) */}
      <div className="sv-cols">
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
      </div>

      {/* 1 การ์ด = 1 ชิ้น */}
      {st.rows.map((row, i) => (
        <div key={i} className="sv-item">
          <div className="sv-item-head"><b>ชิ้นที่ {i + 1}</b>
            {st.rows.length > 1 && <button type="button" className="btn ghost sm" onClick={() => set({ ...st, rows: st.rows.filter((_, k) => k !== i) })}>🗑 ลบชิ้นนี้</button>}</div>
          {st.cols.map((c, j) => (
            <label key={j} className="field sv-field"><span>{c || `ช่อง ${j + 1}`}</span>
              <input className="input" value={row[j] ?? ''} placeholder={`ใส่${c || 'ข้อมูล'}`} onChange={(e) => setCell(i, j, e.target.value)} onPaste={(e) => paste(e, i, j)} /></label>
          ))}
        </div>
      ))}

      <button type="button" className="btn sv-more" onClick={() => set({ ...st, rows: [...st.rows, st.cols.map(() => '')] })}>＋ เพิ่มอีกชิ้น</button>
      <small className="faint">มีหลายชิ้น? วาง <code>อีเมล | รหัส | โปรไฟล์</code> หลายบรรทัด (หรือก๊อปจาก Excel) ลงช่องแรกของชิ้นที่ 1 ระบบแยกเป็นหลายชิ้นให้เอง</small>
    </div>
  );
}
