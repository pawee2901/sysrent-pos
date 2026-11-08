'use client';
import { to } from '@/lib/routes';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { PromptPayPanel, type Qr } from '@/components/PromptPay';

/** เลือกจ่ายด้วยกระเป๋า (ยอดพอ) หรือพร้อมเพย์ (QR ยอดเท่าออเดอร์) */
export function PayBox({ code, total, balance, expiresAt }: { code: string; total: number; balance: number; expiresAt: string }) {
  const router = useRouter();
  const enough = balance >= total;
  const [method, setMethod] = useState<'wallet' | 'promptpay'>(enough ? 'wallet' : 'promptpay');
  const [qr, setQr] = useState<Qr | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pay(m = method) {
    setBusy(true); setErr('');
    const r = await api<Qr>(`/api/orders/${code}/pay`, { method: m });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    if (m === 'wallet') { router.replace(to(`/orders/${code}?paid=1`)); router.refresh(); return; }
    setQr(r.data);
  }

  if (qr) {
    return <PromptPayPanel qr={qr} onRenew={() => { setQr(null); pay('promptpay'); }}
      onPaid={(p) => { if (p.order) { router.replace(to(`/orders/${p.order}?paid=1`)); router.refresh(); } else { setQr(null); setErr(p.orderError ?? 'เงินเข้ากระเป๋าแล้ว'); router.refresh(); } }} />;
  }
  return (
    <>
      <div className="steps"><span className="step on" /><span className="step on" /><span className="step" /></div>
      <h3 style={{ fontSize: 16, marginBottom: 10 }}>วิธีชำระเงิน</h3>
      <button type="button" className={`pay-opt${method === 'promptpay' ? ' on' : ''}`} onClick={() => setMethod('promptpay')} style={{ width: '100%', font: 'inherit', background: 'none' }}>
        <span className="pay-ic">📱</span><span className="grow" style={{ textAlign: 'left' }}><b>พร้อมเพย์ (QR)</b><small>สแกนจ่าย ตรวจสลิปอัตโนมัติ</small></span>
      </button>
      <button type="button" className={`pay-opt${method === 'wallet' ? ' on' : ''}`} disabled={!enough} onClick={() => setMethod('wallet')} style={{ width: '100%', font: 'inherit', background: 'none', opacity: enough ? 1 : .55 }}>
        <span className="pay-ic">💳</span><span className="grow" style={{ textAlign: 'left' }}><b>กระเป๋าเงิน</b><small>คงเหลือ {baht(balance)}{enough ? ' · จ่ายทันที' : ' · ไม่พอ'}</small></span>
      </button>
      <button type="button" className="btn primary lg block" style={{ marginTop: 6 }} disabled={busy} onClick={() => pay()}>
        {busy ? 'กำลังดำเนินการ…' : method === 'wallet' ? `จ่าย ${baht(total)} ด้วยกระเป๋าเงิน` : 'สร้าง QR พร้อมเพย์'}
      </button>
      <p className="faint" style={{ fontSize: 13, marginTop: 10 }}>ชำระภายใน {new Date(expiresAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. ไม่งั้นออเดอร์จะถูกยกเลิก</p>
      {err && <p style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">{err}</p>}
    </>
  );
}
