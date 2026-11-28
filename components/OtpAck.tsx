'use client';
import { useState } from 'react';
import { Layer } from '@/components/Layer';

/** text = ข้อความที่ร้านเขียนเอง ('' = มาตรฐาน) · ใส่ {limit} {left} ได้ */
export type NeedAck = { limit: number; used: number; name?: string; per?: string; text?: string };

/**
 * ป๊อปอัปก่อนค้นหา OTP (ออเดอร์ / รหัสตัวแทนที่จำกัดจำนวนครั้ง)
 * ลูกค้าต้องอ่านและติ๊ก "เข้าใจแล้ว" ก่อน ถึงจะกดค้นหาได้
 */
export function OtpAck({ need, onOk, onCancel }: { need: NeedAck; onOk: () => void; onCancel: () => void }) {
  const [ok, setOk] = useState(false);
  const left = Math.max(0, need.limit - need.used);
  return (
    <Layer>
      <div className="rd-bg" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className="rd" role="dialog" aria-modal="true" aria-labelledby="otpack-title" style={{ maxWidth: 440 }}>
          <div className="rd-head"><div><h2 id="otpack-title">⚠️ อ่านก่อนกดค้นหา</h2>{need.name && <span className="muted">{need.name}</span>}</div>
            <button type="button" className="icon-btn" onClick={onCancel} aria-label="ปิด">✕</button></div>
          <div className="rd-body" style={{ display: 'grid', gap: 12 }}>
            {need.text ? (
              <div style={{ padding: '14px 16px', borderRadius: 14, background: 'color-mix(in srgb, var(--warn) 12%, transparent)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {need.text.split('{limit}').join(String(need.limit)).split('{left}').join(String(left))}
              </div>
            ) : <div style={{ padding: '14px 16px', borderRadius: 14, background: 'color-mix(in srgb, var(--warn) 12%, transparent)', lineHeight: 1.65 }}>
              {need.per
                ? <>รหัสนี้ขอ OTP ได้ <b>{need.limit} ครั้ง ต่อ{need.per}</b></>
                : <>ออเดอร์นี้ขอ OTP ได้ <b>{need.limit} ครั้ง</b> เท่านั้น</>}
              {' '}· เหลือ <b>{left} ครั้ง</b>
              <br />เมื่อกดค้นหาแล้วได้รหัส จะนับ 1 ครั้งทันที{left <= 1 ? ' และจะกดขอไม่ได้อีก' : ''}
              <br /><small className="muted">กรุณากด &quot;ส่งรหัส&quot; ในแอปก่อน แล้วค่อยกดค้นหา</small>
            </div>}
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 14.5 }}>
              <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: 'var(--accent)', flex: 'none' }} />
              <span>ฉันอ่านและเข้าใจแล้ว ว่าขอ OTP ได้จำกัดจำนวนครั้ง</span>
            </label>
          </div>
          <div className="rd-foot" style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onCancel}>ยกเลิก</button>
            <button type="button" className="btn primary" disabled={!ok} onClick={onOk} style={{ flex: 1 }}>🔍 ค้นหารหัส</button>
          </div>
        </div>
      </div>
    </Layer>
  );
}
