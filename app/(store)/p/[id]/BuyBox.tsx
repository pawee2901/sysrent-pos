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
export function BuyBox({ product, options, open, preorder = null, children }: { product: P; options: Opt[]; open: boolean; preorder?: { note: string } | null; children?: React.ReactNode }) {
  const router = useRouter();
  const cart = useCart();
  const first = Math.max(0, options.findIndex((o) => o.stock === null || o.stock > 0));
  /** แพ็กเกจนี้ของหมด แต่ร้านเปิดพรีออเดอร์ = จองได้ */
  const isPre = (x?: Opt) => !!preorder && !!x && product.fulfillment === 'stock' && (x.stock ?? 0) < 1;
  const [pick, setPick] = useState(first);
  const [msg, setMsg] = useState('');
  const [buying, setBuying] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const o = options[pick];
  const max = !o ? 0 : isPre(o) ? 20 : product.fulfillment === 'stock' ? Math.min(20, o.stock ?? 0) : o.stock === 0 ? 0 : 1;

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
    const r = await api<{ code: string }>('/api/orders', { lines: [{ optionId: o.id, qty: 1, info }], coupon: coupon.trim() || undefined });
    if (r.status === 401) { router.push(loginUrl(`/p/${product.id}`)); return; }
    if (!r.ok) { setBuying(false); setMsg(r.error); return; }
    router.push(to(`/checkout/${r.data.code}`));
  }
  return (
    <>
      <div className="plans" role="radiogroup" aria-label="แพ็กเกจ">
        {options.map((x, i) => {
          const out = x.stock !== null && x.stock < 1 && !isPre(x);
          return (
            <button key={x.id} type="button" role="radio" aria-checked={i === pick} disabled={out} className={`plan${i === pick ? ' on' : ''}`} onClick={() => { setPick(i); setMsg(''); }} style={out ? { opacity: .5 } : undefined}>
              <span className="muted" style={{ fontSize: 14 }}>{x.name}{out ? ' · หมด' : isPre(x) ? ' · พรีออเดอร์' : ''}</span><b>{baht(x.price)}</b>{x.compareAt && x.compareAt > x.price ? <s>{baht(x.compareAt)}</s> : <s>&nbsp;</s>}
            </button>
          );
        })}
      </div>
      {children}
      {isPre(o) && <div className="preorder-note" role="note"><b>📦 สินค้านี้เปิดพรีออเดอร์</b><span>จ่ายตอนนี้เพื่อจองคิว · ร้านเติมของเมื่อไหร่ ระบบส่งรหัสให้เองทันที (จองก่อนได้ก่อน) · ยังไม่ได้ของ ร้านคืนเงินเข้ากระเป๋าได้</span>{preorder?.note && <span>⏱ {preorder.note}</span>}</div>}
      <div className="buy-panel">
        {!couponOpen ? (
          <button type="button" className="coupon-toggle" onClick={() => setCouponOpen(true)}>🏷️ มีโค้ดส่วนลด?</button>
        ) : (
          <div className="coupon-row">
            <span className="coupon-ic" aria-hidden>🏷️</span>
            <input className="input" autoFocus aria-label="โค้ดส่วนลด" value={coupon} maxLength={20} placeholder="กรอกโค้ด เช่น NEW10" onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setMsg(''); }} />
            {coupon && <button type="button" className="coupon-clear" aria-label="ล้างโค้ด" onClick={() => setCoupon('')}>✕</button>}
          </div>
        )}
        {coupon.trim() && <small className="faint coupon-hint">โค้ดใช้กับปุ่ม &quot;ซื้อเลย&quot; · ถ้าใส่ตะกร้า ให้กรอกอีกครั้งที่หน้าตะกร้า</small>}
        <div className="buy-bar">
          <button type="button" className="btn lg cart-btn" disabled={max < 1} onClick={() => { if (put()) setMsg('ใส่ตะกร้าแล้ว 🛒'); }}>🛒 ใส่ตะกร้า</button>
          <button type="button" className="btn primary lg buy-btn" disabled={max < 1 || buying} onClick={buyNow}>
            {buying ? 'กำลังสร้างออเดอร์…' : <><span>{isPre(o) ? 'จองเลย' : 'ซื้อเลย'}</span>{o && <b>{baht(o.price)}</b>}</>}
          </button>
        </div>
      </div>
      {product.askInfo && <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>📝 ร้านจะขอ <b>{product.askInfo}</b> ก่อนจ่ายเงิน</p>}
      {msg && <p className="muted" role="status" style={{ marginTop: 10 }}>{msg}</p>}
    </>
  );
}
