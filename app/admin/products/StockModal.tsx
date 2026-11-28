'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/components/dialog';
import type { DForm } from './DeliveryForm';
import { StockPanel } from './StockPanel';
import type { MoveTarget } from './StockList';
import css from './dform.module.css';

export type StockProduct = { id: string; name: string; options: { id: string; name: string; days: string; stock: number }[] };
export type OtpInfo = { ready: boolean; apps: { id: string; name: string }[]; picks: Record<string, string> } | null;

/** หน้าต่างสต็อก (แยกจากหน้าแก้สินค้า): เลือกแพ็กเกจ → เติม / ดูของในสต็อก */
export function StockModal({ product, optionId, forms, otp, onClose, targets, limits = {} }: { product: StockProduct; optionId?: string; forms: Record<string, DForm>; otp: OtpInfo; onClose: () => void; targets: MoveTarget[]; limits?: Record<string, number> }) {
  const router = useRouter();
  const [opt, setOpt] = useState(optionId ?? product.options[0]?.id ?? '');
  const [formMap, setFormMap] = useState(forms);
  const [otpApp, setOtpApp] = useState(otp?.picks[product.id] ?? '');
  const o = product.options.find((x) => x.id === opt) ?? product.options[0];
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className={css.mBg} onClick={onClose}>
      <div className={css.modal} role="dialog" aria-modal="true" aria-label={`สต็อก ${product.name}`} onClick={(e) => e.stopPropagation()}>
        <div className={css.mHead}>
          <div><small className="muted">สต็อก</small><b>{product.name}</b></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className={css.mBody}>
          {product.options.length > 1 && (
            <div className={css.opts} role="radiogroup" aria-label="เลือกแพ็กเกจ">
              {product.options.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={x.id === o?.id} className={x.id === o?.id ? css.on : ''} onClick={() => setOpt(x.id)}>
                  {x.name}<small>{x.stock ? `เหลือ ${x.stock}` : 'หมด'}</small></button>
              ))}
            </div>
          )}
          {!o ? <p className="muted">สินค้านี้ยังไม่มีแพ็กเกจ · เพิ่มแพ็กเกจและราคาในหน้าแก้สินค้าก่อน</p> : (
            <StockPanel key={o.id} productId={product.id} option={{ id: o.id, name: o.name, days: o.days }} left={o.stock}
              form={formMap[o.id] ?? null} onForm={(fm) => setFormMap((m) => { const n = { ...m }; if (fm) n[o.id] = fm; else delete n[o.id]; return n; })}
              otp={otp} otpApp={otpApp} setOtpApp={setOtpApp} savedOtpApp={otp?.picks[product.id] ?? ''}
              onAdded={(notice) => { if (notice) notify(notice); router.refresh(); }} targets={targets} otpLimit={limits[o.id] ?? 0} />
          )}
        </div>
      </div>
    </div>
  );
}
