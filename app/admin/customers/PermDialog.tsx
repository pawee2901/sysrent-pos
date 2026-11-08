'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PERMS, DEFAULT_STAFF_PERMS, type Perm } from '@/lib/perms';

/** เลือกเมนูหลังบ้านที่แอดมินคนนี้เข้าได้ (ใช้ตอนตั้งเป็นแอดมิน และตอนแก้สิทธิ์ภายหลัง) */
export function PermDialog({ username, initial, isNew, onClose, onSave }: {
  username: string; initial?: Perm[]; isNew: boolean; onClose: () => void; onSave: (perms: Perm[]) => Promise<boolean>;
}) {
  const [sel, setSel] = useState<Perm[]>(initial?.length ? initial : DEFAULT_STAFF_PERMS);
  const [busy, setBusy] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    setHost(document.body);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const toggle = (k: Perm) => setSel(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]);
  const all = sel.length === PERMS.length;
  async function save() {
    setBusy(true);
    const ok = await onSave(PERMS.map((p) => p.key).filter((k) => sel.includes(k)));
    setBusy(false);
    if (ok) onClose();
  }
  if (!host) return null;
  return createPortal(
    <div className="pd-bg" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="pd" role="dialog" aria-modal="true" aria-labelledby="pd-title">
        <div className="pd-head">
          <div><h2 id="pd-title">{isNew ? `ตั้ง @${username} เป็นแอดมิน` : `สิทธิ์ของ @${username}`}</h2>
            <span className="muted">เลือกเมนูหลังบ้านที่คนนี้เข้าได้ · เมนูที่ไม่ได้เลือกจะไม่เห็นเลย</span></div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="ปิด">✕</button>
        </div>
        <div className="pd-body">
          <button type="button" className="pd-all" onClick={() => setSel(all ? [] : PERMS.map((p) => p.key))}>{all ? 'ไม่เลือกทั้งหมด' : 'เลือกทั้งหมด'}</button>
          <div className="pd-list">{PERMS.map((p) => (
            <label key={p.key} className={`pd-item${sel.includes(p.key) ? ' on' : ''}`}>
              <input type="checkbox" checked={sel.includes(p.key)} onChange={() => toggle(p.key)} />
              <span><b>{p.label}</b><small>{p.desc}</small></span>
            </label>
          ))}</div>
          <p className="pd-note">🔒 แอดมิน<b>ทำไม่ได้</b>เสมอ: ตั้ง / ถอดยศแอดมิน · แก้สิทธิ์แอดมิน · เปลี่ยนรหัสบัญชีหลังบ้านของร้าน</p>
        </div>
        <div className="pd-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button type="button" className="btn primary" onClick={save} disabled={busy || !sel.length}>{busy ? 'กำลังบันทึก…' : isNew ? `ตั้งเป็นแอดมิน (${sel.length} เมนู)` : `บันทึกสิทธิ์ (${sel.length} เมนู)`}</button>
        </div>
      </div>
    </div>,
    host,
  );
}
