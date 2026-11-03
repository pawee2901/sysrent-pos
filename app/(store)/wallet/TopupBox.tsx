'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, baht } from '@/components/Cart';
import { PromptPayPanel, type Qr } from '@/components/PromptPay';

export function TopupBox() {
  const router = useRouter();
  const [amount, setAmount] = useState('100');
  const [qr, setQr] = useState<Qr | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function create() {
    setBusy(true); setMsg('');
    const r = await api<Qr>('/api/topup', { amount: Number(amount) });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    setQr(r.data);
  }
  if (qr) return <PromptPayPanel qr={qr} onRenew={create} onPaid={(p) => { setQr(null); setMsg(`เติมเงิน ${baht(p.amount)} สำเร็จ 🎉`); router.refresh(); }} />;
  return (
    <>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {[50, 100, 300, 500, 1000].map((v) => <button key={v} type="button" className={`chip${Number(amount) === v ? ' on' : ''}`} onClick={() => setAmount(String(v))}>{baht(v)}</button>)}
      </div>
      <label className="field" style={{ marginTop: 12 }}><span>จำนวนเงิน (บาท)</span><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))} /></label>
      <button type="button" className="btn primary lg block" style={{ marginTop: 14 }} disabled={busy || Number(amount) < 10} onClick={create}>{busy ? 'กำลังสร้าง QR…' : 'สร้าง QR พร้อมเพย์'}</button>
      {msg && <p className="muted" role="status" style={{ marginTop: 10 }}>{msg}</p>}
    </>
  );
}
