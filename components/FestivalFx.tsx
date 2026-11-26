'use client';
import { BUILTIN_THEMES, EffectLayer, ThemeBackdrop } from '@/components/addons/AddonArt';

/**
 * ธีมเทศกาล (ฟังก์ชันเสริมจาก SysRent): รูปฉากเต็มจอ + หิมะ/พลุ/ดอกไม้ ฯลฯ เคลื่อนไหว
 * หน้าร้าน = อยู่หลังเนื้อหาทั้งหมด (.fest-layer z-index -1 เหมือน .shop-bg) · contained = กรอบตัวอย่างในหลังบ้าน
 */
export function FestivalFx({ code, contained = false, scene = true }: { code: string; contained?: boolean; scene?: boolean }) {
  const theme = BUILTIN_THEMES[code];
  if (!theme) return null;
  return (
    <div className={contained ? 'fest-layer contained' : 'fest-layer'} aria-hidden="true" style={scene && !theme.image ? { background: theme.bg } : undefined}>
      {scene && <ThemeBackdrop theme={theme} contained={contained} />}
      <EffectLayer theme={theme} contained={contained} />
    </div>
  );
}
