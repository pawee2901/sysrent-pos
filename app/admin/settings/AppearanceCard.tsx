'use client';
import { useState } from 'react';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';
import { FloatingFx } from '@/components/FloatingFx';
import { LoaderMark } from '@/components/PageLoader';
import { EFFECTS, FONTS, LOADERS, allFontsHref, fontStack } from '@/lib/appearance';
import { MUSIC_HINT, parseMusic } from '@/lib/music';

export type AppearanceInit = { enabled: boolean; ready: boolean; font: string; effect: string; loader: string; music_url: string };

/** ฟอนต์ · เอฟเฟกต์ลอย · เอฟเฟกต์รอโหลด · เพลงในเว็บ */
export function AppearanceCard({ init, logo }: { init: AppearanceInit; logo: string }) {
  const [f, setF] = useState({ font: init.font, effect: init.effect, loader: init.loader, music_url: init.music_url });
  const [busy, setBusy] = useState(false);
  const badMusic = !!f.music_url.trim() && !parseMusic(f.music_url);

  async function save() {
    setBusy(true);
    const r = await api('/api/admin/settings', { action: 'appearance', ...f });
    setBusy(false);
    if (r.ok) notify('บันทึกแล้ว เปิดหน้าร้านดูได้เลย'); else notify(r.error, 'error');
  }

  return (
    <section className="card">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={allFontsHref} precedence="default" />
      <div className="card-head"><h2>ฟอนต์ · เพลง · เอฟเฟกต์</h2><button type="button" className="btn primary sm" disabled={busy || !init.ready || !init.enabled || badMusic} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึกส่วนนี้'}</button></div>
      <div className="form">
        {!init.enabled && <p style={{ margin: 0, fontWeight: 600 }}>🔒 ลองเลือกดูตัวอย่างได้ · ใช้งานจริงในแพ็กเกจ Pro (฿399/เดือน) ขึ้นไป · อัปเกรดที่ sysrent.shop</p>}
        {!init.ready && <p style={{ color: 'var(--warn)', margin: 0 }}>⚠️ ต้องรัน SQL <code>0022_shop_appearance.sql</code> ใน Supabase ก่อน</p>}

        <div className="field"><span>ฟอนต์ตัวหนังสือ</span>
          <div className="ap-fonts">
            <button type="button" className={`ap-font${!f.font ? ' on' : ''}`} onClick={() => setF({ ...f, font: '' })}><b>ตามธีม</b><small>ฟอนต์เริ่มต้นของธีม</small></button>
            {FONTS.map((x) => (
              <button key={x.key} type="button" className={`ap-font${f.font === x.key ? ' on' : ''}`} style={{ fontFamily: fontStack(x.family) }} onClick={() => setF({ ...f, font: x.key })}><b>ร้านของฉัน</b><small>{x.name}</small></button>
            ))}
          </div></div>

        <div className="field"><span>เอฟเฟกต์ลอย</span>
          <div className="ap-picks">{EFFECTS.map(([k, l, icon]) => <button key={k} type="button" className={`ap-pick${f.effect === k ? ' on' : ''}`} onClick={() => setF({ ...f, effect: k })}>{icon} {l}</button>)}</div>
          {f.effect !== 'none' && <div className="ap-preview"><FloatingFx effect={f.effect} contained /></div>}
        </div>

        <div className="field"><span>เอฟเฟกต์รอโหลด (ตอนเปิดเว็บ)</span>
          <div className="ap-picks">{LOADERS.map(([k, l]) => <button key={k} type="button" className={`ap-pick${f.loader === k ? ' on' : ''}`} onClick={() => setF({ ...f, loader: k })}>{l}</button>)}</div>
          {f.loader !== 'none' && <div className="ap-preview center"><LoaderMark kind={f.loader} logo={logo} /></div>}
        </div>

        <label className="field"><span>เพลงในเว็บ (ไม่ใส่ = ไม่มีเพลง)</span>
          <input className="input" value={f.music_url} maxLength={500} placeholder="https://www.youtube.com/watch?v=..." onChange={(e) => setF({ ...f, music_url: e.target.value })} />
          <small className={badMusic ? '' : 'faint'} style={{ fontSize: 12, color: badMusic ? 'var(--bad)' : undefined }}>{badMusic ? 'ลิงก์นี้ใช้ไม่ได้ · ' : ''}{MUSIC_HINT} · เพลงเริ่มเมื่อลูกค้าแตะหน้าเว็บครั้งแรก และลูกค้ากดปิดได้</small></label>
      </div>
    </section>
  );
}
