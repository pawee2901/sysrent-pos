'use client';
import { useState } from 'react';
import { fieldIcon, parseDelivered } from '@/lib/fields';

/** รหัส / บัญชีที่ลูกค้าได้ — แยกเป็นช่อง มีปุ่มคัดลอกทีละช่อง + คัดลอกทั้งหมด */
export function Delivered({ content, warranty }: { content: string; warranty?: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const lines = parseDelivered(content);
  const fields = lines.filter((l) => l.kind === 'field').length;

  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }
  const btn = (key: string, text: string, label = 'คัดลอก') => (
    <button type="button" className={`copy-btn${copied === key ? ' done' : ''}`} onClick={() => copy(key, text)}>{copied === key ? '✓ คัดลอกแล้ว' : `⧉ ${label}`}</button>
  );

  // ไม่มีช่องเลย (ข้อความยาวล้วน) → กล่องข้อความ + ปุ่มคัดลอกทั้งหมด
  if (!fields) {
    return (
      <div className="dlv">
        <div className="dlv-text">{btn('all', content, 'คัดลอก')}<pre>{content}</pre></div>
        {warranty && <Row icon="📅" label="หมดประกัน" value={warranty} />}
      </div>
    );
  }
  return (
    <div className="dlv">
      {lines.map((l, i) => l.kind === 'field'
        ? <Row key={i} icon={fieldIcon(l.label)} label={l.label} value={l.value} action={btn(`f${i}`, l.value)} />
        : l.text.trim() ? <p key={i} className="dlv-note">{l.text}</p> : null)}
      {warranty && <Row icon="📅" label="หมดประกัน" value={warranty} />}
      {fields > 1 && <div className="dlv-all">{btn('all', content, 'คัดลอกทั้งหมด')}</div>}
    </div>
  );
}

function Row({ icon, label, value, action }: { icon: string; label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="dlv-row">
      <span className="dlv-label">{icon && <i>{icon}</i>}{label}</span>
      <div className="dlv-val"><span className="dlv-box">{value}</span>{action}</div>
    </div>
  );
}
