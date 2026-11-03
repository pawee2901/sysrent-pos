'use client';
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

  async function checkout() {
    setBusy(true); setErr('');
    const r = await api<{ code: string }>('/api/orders', { lines: cart.lines.map((l) => ({ optionId: l.optionId, qty: l.qty })) });
    if (r.status === 401) { router.push('/login?next=/cart'); return; }
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    cart.clear();
    router.push(`/checkout/${r.data.code}`);
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
            </div>
          ))}
        </div>
        <div className="card card-pad">
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>สรุปยอด</h3>
          <div className="sum-row"><span>ราคาสินค้า</span><span className="num">{baht(cart.total)}</span></div>
          <div className="sum-row total"><span>ยอดชำระ</span><b className="num">{baht(cart.total)}</b></div>
          <button type="button" className="btn primary lg block" style={{ marginTop: 14 }} disabled={busy} onClick={checkout}>{busy ? 'กำลังสร้างออเดอร์…' : 'ไปชำระเงิน'}</button>
          {err && <p style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">{err}</p>}
          <p className="faint" style={{ fontSize: 13, marginTop: 10 }}>ราคาสุดท้ายยืนยันอีกครั้งในหน้าชำระเงิน</p>
        </div>
      </div>
    </>
  );
}
