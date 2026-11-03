'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { AppLogo } from '@/components/AppLogo';
import { FULFILL_LABEL, TEMPLATES, templateOf } from '@/lib/templates';
import type { Product } from '@/lib/catalog';

type OptF = { id?: string; name: string; price: string; compare_at: string; cost: string; duration_days: string; active: boolean };
type Form = { id?: string; name: string; category: string; description: string; image: string; template: string; fulfillment: 'stock' | 'slot' | 'manual'; badge: string; active: boolean; options: OptF[] };
const num = (s: string) => (s.trim() === '' ? null : Number(s));
const blank = (): Form => ({ name: '', category: 'ดูหนัง', description: '', image: '', template: '', fulfillment: 'slot', badge: '', active: true, options: [{ name: '30 วัน', price: '', compare_at: '', cost: '', duration_days: '30', active: true }] });
const fromProduct = (p: Product): Form => ({
  id: p.id, name: p.name, category: p.category, description: p.description, image: p.image, template: p.template, fulfillment: p.fulfillment, badge: p.badge, active: p.active,
  options: p.options.map((o) => ({ id: o.id, name: o.name, price: String(o.price), compare_at: o.compareAt?.toString() ?? '', cost: o.cost?.toString() ?? '', duration_days: o.durationDays?.toString() ?? '', active: o.active })),
});

/** สินค้า: ตาราง + เพิ่มจากแม่แบบ + แผงแก้ไข (ข้อมูล · แพ็กเกจ · สต็อก) */
export function ProductsClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const [f, setF] = useState<Form | null>(null);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [stock, setStock] = useState<{ optionId: string; text: string } | null>(null);
  const [q, setQ] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const editing = f?.id ? products.find((p) => p.id === f.id) : undefined;

  function fromTemplate(key: string) {
    const t = templateOf(key)!;
    setF({ ...blank(), name: t.name, category: t.category, description: t.description, template: t.key, fulfillment: t.fulfillment,
      options: t.plans.map(([n, price, days]) => ({ name: n, price: String(price), compare_at: '', cost: '', duration_days: String(days), active: true })) });
    setPick(false); setMsg('');
  }
  async function save() {
    if (!f) return;
    setBusy(true); setMsg('');
    const r = await api<{ id: string }>('/api/admin/products', { action: 'save', id: f.id, data: {
      name: f.name, category: f.category, description: f.description, image: f.image, template: f.template, fulfillment: f.fulfillment, badge: f.badge, active: f.active,
      options: f.options.map((o) => ({ id: o.id, name: o.name, price: Number(o.price), compare_at: num(o.compare_at), cost: num(o.cost), duration_days: num(o.duration_days), active: o.active })),
    } });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
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
    if (confirmText && !confirm(confirmText)) return;
    const r = await api<{ notice?: string }>('/api/admin/products', body);
    if (!r.ok) { alert(r.error); return; }
    if (r.data.notice) alert(r.data.notice);
    router.refresh();
  }
  async function addStock() {
    if (!stock) return;
    setBusy(true);
    const r = await api<{ notice: string }>('/api/admin/products', { action: 'stock', ...stock });
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
        <div className="acts"><button type="button" className="btn" onClick={() => setPick(true)}>✨ เพิ่มจากแม่แบบ</button><button type="button" className="btn primary" onClick={() => { setF(blank()); setMsg(''); }}>+ เพิ่มสินค้า</button></div></div>
      <div className="kpis">
        <div className="card kpi"><span className="lbl">เปิดขาย</span><span className="val num">{live.length}</span><span className="delta mute">จาก {products.length} สินค้า</span></div>
        <div className="card kpi"><span className="lbl">ของหมด</span><span className="val num">{live.filter((p) => !p.inStock).length}</span><span className="delta mute">{live.filter((p) => !p.inStock).map((p) => p.name).slice(0, 2).join(', ') || 'ไม่มี 👍'}</span></div>
        <div className="card kpi"><span className="lbl">ขายแล้วทั้งหมด</span><span className="val num">{products.reduce((s, p) => s + p.sold, 0).toLocaleString('th-TH')}</span><span className="delta mute">ชิ้น</span></div>
        <div className="card kpi"><span className="lbl">ขายดีสุด</span><span className="val" style={{ fontSize: 20 }}>{[...products].sort((a, b) => b.sold - a.sold)[0]?.name ?? '—'}</span><span className="delta mute">{[...products].sort((a, b) => b.sold - a.sold)[0]?.sold ?? 0} ชิ้น</span></div>
      </div>
      <section className="card">
        <div className="toolbar"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นหาสินค้า" /></div>
        {!products.length ? <div className="card-pad"><p className="muted" style={{ margin: 0 }}>ยังไม่มีสินค้า — กด &quot;✨ เพิ่มจากแม่แบบ&quot; เพื่อเริ่มเร็วที่สุด</p></div> : (
          <table className="tbl">
            <thead><tr><th>สินค้า</th><th>วิธีส่งของ</th><th className="r">ราคา</th><th>สต็อก</th><th className="r">ขายแล้ว</th><th>เปิดขาย</th></tr></thead>
            <tbody>{shown.map((p) => (
              <tr key={p.id} onClick={() => { setF(fromProduct(p)); setMsg(''); setStock(null); }} style={{ opacity: p.active ? 1 : .55 }}>
                <td className="m-full"><div className="prod"><AppLogo image={p.image} template={p.template} name={p.name} /><div><b>{p.name}</b><small>{p.options.filter((o) => o.active).map((o) => o.name).join(' · ') || 'ยังไม่มีแพ็กเกจ'}</small></div></div></td>
                <td className="m-hide"><span className="pill plain">{FULFILL_LABEL[p.fulfillment]}</span></td>
                <td className="r num">{p.from !== null ? baht(p.from) : '—'}</td>
                <td><div className="stockbar"><span className={`num${p.inStock ? '' : ' faint'}`}>{p.left === null ? 'ไม่จำกัด' : p.left ? `${p.left} ${p.fulfillment === 'slot' ? 'จอ' : 'ชิ้น'}` : 'หมด'}</span>{p.left !== null && <div className={`meter${p.left <= 3 ? ' warn' : ''}`}><i style={{ width: `${Math.min(100, p.left * 5)}%` }} /></div>}</div></td>
                <td className="r num m-hide">{p.sold.toLocaleString('th-TH')}</td>
                <td><button type="button" className={`toggle${p.active ? ' on' : ''}`} aria-label="เปิด/ปิดขาย" onClick={(e) => { e.stopPropagation(); simple({ action: 'toggle', id: p.id, active: !p.active }); }} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      {pick && (
        <div className="cmd-bg open" onClick={(e) => { if (e.target === e.currentTarget) setPick(false); }}>
          <div className="card cmd" role="dialog" aria-label="เลือกแม่แบบ" style={{ padding: 18 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>เลือกแม่แบบสินค้า</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {TEMPLATES.map((t) => (
                <button key={t.key} type="button" className="btn" style={{ height: 'auto', padding: 12, flexDirection: 'column', gap: 6 }} onClick={() => fromTemplate(t.key)}>
                  <AppLogo template={t.key} name={t.name} /><b style={{ fontSize: 13 }}>{t.name}</b><small className="muted" style={{ fontSize: 11 }}>{FULFILL_LABEL[t.fulfillment]}</small>
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>เลือกแล้วแก้ชื่อ ราคา และรายละเอียดได้ทั้งหมด · อัปโหลดรูปโลโก้จริงได้</p>
          </div>
        </div>
      )}

      <div className={`drawer-bg${f ? ' open' : ''}`} onClick={() => setF(null)} />
      <aside className={`drawer${f ? ' open' : ''}`} aria-hidden={!f} style={{ width: 'min(520px, 100%)' }}>
        {f && <>
          <div className="drawer-head"><b style={{ flex: 1, fontSize: 17 }}>{f.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</b><button type="button" className="icon-btn" onClick={() => setF(null)} aria-label="ปิด">✕</button></div>
          <div className="drawer-body">
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
              <label className="field"><span>หมวด</span><input className="input" value={f.category} maxLength={30} list="cats" onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="cats"><option value="ดูหนัง" /><option value="เพลง" /><option value="ทำงาน" /><option value="เกม" /></datalist></label>
              <label className="field"><span>ป้าย (ไม่บังคับ)</span><input className="input" value={f.badge} maxLength={16} placeholder="ขายดี / ใหม่" onChange={(e) => setF({ ...f, badge: e.target.value })} /></label>
            </div>
            <label className="field"><span>วิธีส่งของ</span>
              <select className="input" value={f.fulfillment} onChange={(e) => setF({ ...f, fulfillment: e.target.value as Form['fulfillment'] })} disabled={!!editing}>
                <option value="slot">แบ่งจอ — เพิ่มบัญชีหลักที่เมนู &quot;คลังบัญชี&quot; ระบบจัดจอให้เอง</option>
                <option value="stock">คลังโค้ด / บัญชี — วางเป็นรายการ ขายแล้วส่งทันที</option>
                <option value="manual">สั่งทำ — ลูกค้าจ่ายแล้ว ร้านส่งเองในหน้าออเดอร์</option>
              </select></label>
            <label className="field"><span>รายละเอียด (ลูกค้าเห็น)</span><textarea className="input" rows={4} value={f.description} maxLength={3000} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>

            <div style={{ display: 'grid', gap: 8 }}>
              <b>แพ็กเกจ / ราคา</b>
              {f.options.map((o, i) => (
                <div key={i} className="card" style={{ padding: 10, display: 'grid', gap: 8, opacity: o.active ? 1 : .6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 8 }}>
                    <input className="input" value={o.name} placeholder="ชื่อ เช่น 30 วัน" aria-label="ชื่อแพ็กเกจ" onChange={(e) => setOpt(i, { name: e.target.value })} />
                    <input className="input" value={o.price} placeholder="ราคา" inputMode="decimal" aria-label="ราคา" onChange={(e) => setOpt(i, { price: e.target.value.replace(/[^\d.]/g, '') })} />
                    <input className="input" value={o.compare_at} placeholder="ราคาเต็ม" inputMode="decimal" aria-label="ราคาเต็ม (ขีดฆ่า)" onChange={(e) => setOpt(i, { compare_at: e.target.value.replace(/[^\d.]/g, '') })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <input className="input" value={o.duration_days} placeholder="วันใช้งาน" inputMode="numeric" aria-label="จำนวนวัน" onChange={(e) => setOpt(i, { duration_days: e.target.value.replace(/\D/g, '') })} />
                    <input className="input" value={o.cost} placeholder="ต้นทุน" inputMode="decimal" aria-label="ต้นทุน" onChange={(e) => setOpt(i, { cost: e.target.value.replace(/[^\d.]/g, '') })} />
                    <button type="button" className="btn ghost sm" onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i) })} aria-label="ลบแพ็กเกจ">🗑</button>
                  </div>
                  {editing && o.id && f.fulfillment === 'stock' && (
                    stock?.optionId === o.id ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <textarea className="input" rows={4} value={stock.text} onChange={(e) => setStock({ ...stock, text: e.target.value })} placeholder={'1 บรรทัด = 1 ชิ้น เช่น\nuser1@mail.com | pass1234\n(หลายบรรทัดต่อชิ้น คั่นด้วยบรรทัด ---)'} />
                        <div style={{ display: 'flex', gap: 6 }}><button type="button" className="btn primary sm" disabled={busy || !stock.text.trim()} onClick={addStock}>เพิ่มสต็อก</button><button type="button" className="btn ghost sm" onClick={() => setStock(null)}>ยกเลิก</button></div>
                      </div>
                    ) : <button type="button" className="btn soft sm" onClick={() => setStock({ optionId: o.id!, text: '' })}>+ เพิ่มสต็อก (เหลือ {editing.options.find((x) => x.id === o.id)?.stock ?? 0})</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn sm" onClick={() => setF({ ...f, options: [...f.options, { name: '', price: '', compare_at: '', cost: '', duration_days: '', active: true }] })}>+ เพิ่มแพ็กเกจ</button>
            </div>
            {f.fulfillment === 'slot' && <p className="muted" style={{ fontSize: 13, margin: 0 }}>💡 บันทึกแล้วไปที่เมนู <b>คลังบัญชี</b> เพื่อเพิ่มบัญชีหลัก + จอ</p>}
            {msg && <p style={{ color: msg.startsWith('เพิ่มสต็อก') ? 'var(--ok)' : 'var(--bad)', margin: 0 }} role="alert">{msg}</p>}
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
