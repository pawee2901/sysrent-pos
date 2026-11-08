'use client';
import { loginUrl } from '@/lib/routes';
import { to } from '@/lib/routes';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, baht, api } from '@/components/Cart';
import { input } from '@/components/dialog';

type Opt = { id: string; name: string; price: number; compareAt: number | null; stock: number | null };
type P = { id: string; name: string; image: string; template: string; fulfillment: string; askInfo: string };

/** เลือกแพ็กเกจ → ใส่ตะกร้า / ซื้อเลย (ไปหน้าจ่ายเงินทันที) */
export function BuyBox({ product, options, open, children }: { product: P; options: Opt[]; open: boolean; children?: React.ReactNode }) {
  const router = useRouter();
  const cart = useCart();
  const first = Math.max(0, options.findIndex((o) => o.stock === null || o.stock > 0));
  const [pick, setPick] = useState(first);
  const [msg, setMsg] = useState('');
  const [buying, setBuying] = useState(false);
  const o = options[pick];
  const max = !o ? 0 : product.fulfillment === 'stock' ? Math.min(20, o.stock ?? 0) : o.stock === 0 ? 0 : 1;

  if (!options.length) return <p className="muted">สินค้านี้ยังไม่เปิดขาย</p>;
  function put(): boolean {
    if (!open) { setMsg('ร้านปิดรับออเดอร์ชั่วคราว'); return false; }
    if (!o || max < 1) { setMsg('แพ็กเกจนี้หมดชั่วคราว'); return false; }
    cart.add({ optionId: o.id, productId: product.id, name: product.name, option: o.name, price: o.price, qty: 1, image: product.image, template: product.template, maxQty: max, ask: product.askInfo || undefined });
    return true;
  }
  /** ซื้อเลย: สร้างออเดอร์ชิ้นนี้ทันที → หน้าเลือกวิธีจ่าย (ไม่ผ่านตะกร้า · ของในตะกร้าเดิมไม่หาย) */
  async function buyNow() {
    if (!open) { setMsg('ร้านปิดรับออเดอร์ชั่วคราว'); return; }
    if (!o || max < 1) { setMsg('แพ็กเกจนี้หมดชั่วคราว'); return; }
    let info: string | undefined;
    if (product.askInfo) {
      const v = await input(product.askInfo, { text: `ร้านต้องใช้ข้อมูลนี้เพื่อส่ง ${product.name} ให้คุณ`, placeholder: product.askInfo, max: 300, ok: 'ไปจ่ายเงิน' });
      if (!v) return;
      info = v;
    }
    setBuying(true); setMsg('');
    const r = await api<{ code: string }>('/api/orders', { lines: [{ optionId: o.id, qty: 1, info }] });
    if (r.status === 401) { router.push(loginUrl(`/p/${product.id}`)); return; }
    if (!r.ok) { setBuying(false); setMsg(r.error); return; }
    router.push(to(`/checkout/${r.data.code}`));
  }
  return (
    <>
      <div className="plans" role="radiogroup" aria-label="แพ็กเกจ">
        {options.map((x, i) => {
          const out = x.stock !== null && x.stock < 1;
          return (
            <button key={x.id} type="button" role="radio" aria-checked={i === pick} disabled={out} className={`plan${i === pick ? ' on' : ''}`} onClick={() => { setPick(i); setMsg(''); }} style={out ? { opacity: .5 } : undefined}>
              <span className="muted" style={{ fontSize: 14 }}>{x.name}{out ? ' · หมด' : ''}</span><b>{baht(x.price)}</b>{x.compareAt && x.compareAt > x.price ? <s>{baht(x.compareAt)}</s> : <s>&nbsp;</s>}
            </button>
          );
        })}
      </div>
      {children}
      <div className="buy-bar">
        <button type="button" className="btn lg" disabled={max < 1} onClick={() => { if (put()) setMsg('ใส่ตะกร้าแล้ว 🛒'); }}>ใส่ตะกร้า</button>
        <button type="button" className="btn primary lg" disabled={max < 1 || buying} onClick={buyNow}>{buying ? 'กำลังสร้างออเดอร์…' : `ซื้อเลย ${o ? baht(o.price) : ''}`}</button>
      </div>
      {product.askInfo && <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>📝 ร้านจะขอ <b>{product.askInfo}</b> ก่อนจ่ายเงิน</p>}
      {msg && <p className="muted" role="status" style={{ marginTop: 10 }}>{msg}</p>}
    </>
  );
}
