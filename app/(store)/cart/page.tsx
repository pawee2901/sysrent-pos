'use client';
import { loginUrl } from '@/lib/routes';
import { to } from '@/lib/routes';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, baht, api } from '@/components/Cart';
import { AppLogo } from '@/components/AppLogo';

/** ตะกร้า → สร้างออเดอร์ที่เซิร์ฟเวอร์ (ราคาจริงจากฐานข้อมูล) → หน้าชำระเงิน */
export default function CartPage() {
  const router = useRouter();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [coupon, setCoupon] = useState('');
  const missing = cart.lines.filter((l) => l.ask && !l.info?.trim());

  async function checkout() {
    if (missing.length) { setErr(`กรุณากรอก${missing[0].ask}ของ ${missing[0].name}`); return; }
    setBusy(true); setErr('');
    const r = await api<{ code: string }>('/api/orders', { lines: cart.lines.map((l) => ({ optionId: l.optionId, qty: l.qty, info: l.info?.trim() || undefined })), coupon: coupon.trim() || undefined });
    if (r.status === 401) { router.push(loginUrl('/cart')); return; }
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    cart.clear();
    router.push(to(`/checkout/${r.data.code}`));
  }

  if (!cart.ready) return null;
  if (!cart.lines.length) {
    return <div className="card success"><div className="success-ic" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>🛒</div><h2>ตะกร้ายังว่าง</h2><p className="muted">เลือกแอปที่ชอบแล้วกดใส่ตะกร้าได้เลย</p><Link href="/" className="btn primary">ไปเลือกสินค้า</Link></div>;
  }
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>ตะกร้าสินค้า</h1>
      <div className="co">
        <div className="card">
          <div className="card-head"><h3>รายการ ({cart.count})</h3><button type="button" className="btn ghost sm" onClick={cart.clear}>ล้างตะกร้า</button></div>
          {cart.lines.map((l) => (
            <div key={l.optionId} className="line-item">
              <AppLogo image={l.image} template={l.template} name={l.name} />
              <div className="grow"><b>{l.name}</b><small>{l.option}</small></div>
              {l.maxQty > 1 && (
                <span className="qty">
                  <button type="button" onClick={() => cart.setQty(l.optionId, l.qty - 1)} aria-label="ลดจำนวน">−</button>
                  <span className="num">{l.qty}</span>
                  <button type="button" onClick={() => cart.setQty(l.optionId, l.qty + 1)} aria-label="เพิ่มจำนวน">+</button>
                </span>
              )}
              <b className="num">{baht(l.price * l.qty)}</b>
              <button type="button" className="icon-btn" aria-label={`ลบ ${l.name}`} onClick={() => cart.remove(l.optionId)}>✕</button>
              {l.ask && (
                <label className="field line-info"><span>📝 {l.ask} <b style={{ color: 'var(--bad)' }}>*</b></span>
                  <input className="input" value={l.info ?? ''} maxLength={300} placeholder={`กรอก${l.ask}`} onChange={(e) => cart.setInfo(l.optionId, e.target.value)} /></label>
              )}
            </div>
          ))}
        </div>
        <div className="card card-pad">
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>สรุปยอด</h3>
          <div className="sum-row"><span>ราคาสินค้า</span><span className="num">{baht(cart.total)}</span></div>
          <label className="field" style={{ marginTop: 10 }}><span>โค้ดส่วนลด</span>
            <input className="input" value={coupon} maxLength={20} placeholder="ถ้ามี เช่น NEW10" style={{ textTransform: 'uppercase', letterSpacing: '.05em' }} onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></label>
          <div className="sum-row total"><span>ยอดชำระ</span><b className="num">{baht(cart.total)}</b></div>
          <button type="button" className="btn primary lg block" style={{ marginTop: 14 }} disabled={busy} onClick={checkout}>{busy ? 'กำลังสร้างออเดอร์…' : 'ไปชำระเงิน'}</button>
          {err && <p style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">{err}</p>}
          <p className="faint" style={{ fontSize: 13, marginTop: 10 }}>{coupon ? 'ส่วนลดจากโค้ดจะแสดงในหน้าชำระเงิน' : 'ราคาสุดท้ายยืนยันอีกครั้งในหน้าชำระเงิน'}</p>
        </div>
      </div>
    </>
  );
}
