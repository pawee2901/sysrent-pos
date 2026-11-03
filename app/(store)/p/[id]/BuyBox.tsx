'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, baht } from '@/components/Cart';

type Opt = { id: string; name: string; price: number; compareAt: number | null; stock: number | null };
type P = { id: string; name: string; image: string; template: string; fulfillment: string };

/** เลือกแพ็กเกจ → ใส่ตะกร้า / ซื้อเลย */
export function BuyBox({ product, options, open }: { product: P; options: Opt[]; open: boolean }) {
  const router = useRouter();
  const cart = useCart();
  const first = Math.max(0, options.findIndex((o) => o.stock === null || o.stock > 0));
  const [pick, setPick] = useState(first);
  const [msg, setMsg] = useState('');
  const o = options[pick];
  const max = !o ? 0 : product.fulfillment === 'stock' ? Math.min(20, o.stock ?? 0) : o.stock === 0 ? 0 : 1;

  if (!options.length) return <p className="muted">สินค้านี้ยังไม่เปิดขาย</p>;
  function put(): boolean {
    if (!open) { setMsg('ร้านปิดรับออเดอร์ชั่วคราว'); return false; }
    if (!o || max < 1) { setMsg('แพ็กเกจนี้หมดชั่วคราว'); return false; }
    cart.add({ optionId: o.id, productId: product.id, name: product.name, option: o.name, price: o.price, qty: 1, image: product.image, template: product.template, maxQty: max });
    return true;
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
      <div className="buy-bar">
        <button type="button" className="btn lg" disabled={max < 1} onClick={() => { if (put()) setMsg('ใส่ตะกร้าแล้ว 🛒'); }}>ใส่ตะกร้า</button>
        <button type="button" className="btn primary lg" disabled={max < 1} onClick={() => { if (put()) router.push('/cart'); }}>ซื้อเลย {o ? baht(o.price) : ''}</button>
      </div>
      {msg && <p className="muted" role="status" style={{ marginTop: 10 }}>{msg}</p>}
    </>
  );
}
