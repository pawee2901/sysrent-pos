'use client';
/**
 * ฟังก์ชันเสริม: ตัวการ์ตูนรอโหลด + ธีมพื้นหลัง/เอฟเฟกต์ตามเทศกาล
 * ⚠ ไฟล์นี้มี 3 ชุดที่เหมือนกัน: sysrantotp (เว็บ OTP) · pos-1 (เว็บร้านค้า) · SysRent (ตัวอย่างตอนซื้อ) — แก้ที่หนึ่งให้คัดลอกไปอีก 2 ที่ด้วย
 *   รูปที่อ้างถึง (public/addons/*) ต้องมีครบทั้ง 3 โปรเจกต์
 */
import { useEffect, useRef } from 'react';

/* ====================================================================== */
/* ตัวการ์ตูนรอโหลด (SVG + CSS animation)                                  */
/* ====================================================================== */

const LOADER_CSS = `
.al{display:block;overflow:visible}
.al *{transform-box:fill-box}
.al-hop{animation:al-hop .9s cubic-bezier(.3,.7,.4,1) infinite;transform-origin:50% 100%}
.al-shadow{animation:al-shadow .9s cubic-bezier(.3,.7,.4,1) infinite;transform-origin:50% 50%}
.al-blink{animation:al-blink 3.2s infinite;transform-origin:50% 50%}
.al-wag{animation:al-wag .45s ease-in-out infinite alternate;transform-origin:0% 100%}
.al-earl{animation:al-earl .9s ease-in-out infinite;transform-origin:50% 100%}
.al-earr{animation:al-earr .9s ease-in-out infinite;transform-origin:50% 100%}
.al-waddle{animation:al-waddle .7s ease-in-out infinite alternate;transform-origin:50% 100%}
.al-flapl{animation:al-flapl .35s ease-in-out infinite alternate;transform-origin:100% 0%}
.al-flapr{animation:al-flapr .35s ease-in-out infinite alternate;transform-origin:0% 0%}
.al-bob{animation:al-bob 1.4s ease-in-out infinite}
.al-step1{animation:al-step .5s ease-in-out infinite alternate;transform-origin:50% 0%}
.al-step2{animation:al-step .5s ease-in-out infinite alternate-reverse;transform-origin:50% 0%}
.al-tail{animation:al-tail .8s ease-in-out infinite alternate;transform-origin:0% 50%}
.al-float{animation:al-float 2s ease-in-out infinite}
.al-floatshadow{animation:al-floatshadow 2s ease-in-out infinite;transform-origin:50% 50%}
.al-wave{animation:al-wave 1.2s ease-in-out infinite alternate;transform-origin:10% 90%}
.al-pop{animation:al-pop 1.1s cubic-bezier(.3,.7,.4,1) infinite;transform-origin:50% 100%}
.al-flame{animation:al-flame .25s ease-in-out infinite alternate;transform-origin:50% 100%}
.al-glow{animation:al-glow 1.2s ease-in-out infinite alternate}
.al-water1{animation:al-water 2.4s linear infinite}
.al-water2{animation:al-water 3.2s linear infinite reverse}
.al-sway{animation:al-sway 2.4s ease-in-out infinite;transform-origin:50% 100%}
@keyframes al-hop{0%,100%{transform:translateY(0) scale(1.08,.92)}15%{transform:translateY(0) scale(1,1)}45%{transform:translateY(-16%) scale(.96,1.05)}70%{transform:translateY(-4%) scale(1,1)}}
@keyframes al-shadow{0%,100%{transform:scale(1);opacity:.25}45%{transform:scale(.6);opacity:.12}}
@keyframes al-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes al-wag{from{transform:rotate(-14deg)}to{transform:rotate(18deg)}}
@keyframes al-earl{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(-16deg)}}
@keyframes al-earr{0%,100%{transform:rotate(4deg)}50%{transform:rotate(16deg)}}
@keyframes al-waddle{from{transform:rotate(-9deg)}to{transform:rotate(9deg)}}
@keyframes al-flapl{from{transform:rotate(8deg)}to{transform:rotate(-26deg)}}
@keyframes al-flapr{from{transform:rotate(-8deg)}to{transform:rotate(26deg)}}
@keyframes al-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4%)}}
@keyframes al-step{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}
@keyframes al-tail{from{transform:rotate(-8deg)}to{transform:rotate(10deg)}}
@keyframes al-float{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10%) rotate(3deg)}}
@keyframes al-floatshadow{0%,100%{transform:scale(1);opacity:.22}50%{transform:scale(.7);opacity:.1}}
@keyframes al-wave{from{transform:rotate(-10deg)}to{transform:rotate(28deg)}}
@keyframes al-pop{0%,100%{transform:translateY(12%)}40%,60%{transform:translateY(-6%)}}
@keyframes al-flame{from{transform:scale(.9,1) rotate(-4deg)}to{transform:scale(1.08,1.12) rotate(4deg)}}
@keyframes al-glow{from{opacity:.35}to{opacity:.75}}
@keyframes al-water{from{transform:translateX(0)}to{transform:translateX(-40px)}}
@keyframes al-sway{0%,100%{transform:rotate(-4deg) translateY(0)}50%{transform:rotate(4deg) translateY(-3%)}}
@media (prefers-reduced-motion:reduce){.al *{animation-duration:3s!important}}
`;

const ink = '#2d2a32';
const Eyes = ({ y = 52, dx = 9, cx = 60 }: { y?: number; dx?: number; cx?: number }) => (
  <g className="al-blink">
    <ellipse cx={cx - dx} cy={y} rx="3.6" ry="4.6" fill={ink} /><circle cx={cx - dx + 1.2} cy={y - 1.6} r="1.2" fill="#fff" />
    <ellipse cx={cx + dx} cy={y} rx="3.6" ry="4.6" fill={ink} /><circle cx={cx + dx + 1.2} cy={y - 1.6} r="1.2" fill="#fff" />
  </g>
);
const Blush = ({ y = 60, dx = 16, cx = 60 }: { y?: number; dx?: number; cx?: number }) => (
  <g fill="#ff8fa3" opacity=".55"><ellipse cx={cx - dx} cy={y} rx="5" ry="3" /><ellipse cx={cx + dx} cy={y} rx="5" ry="3" /></g>
);
const Shadow = ({ cls = 'al-shadow' }: { cls?: string }) => <ellipse className={cls} cx="60" cy="112" rx="24" ry="4.5" fill="#000" opacity=".22" />;

const CAT = (
  <>
    <Shadow />
    <g className="al-hop">
      <path className="al-wag" d="M86 92 C102 88 104 70 96 62" fill="none" stroke="#f08a24" strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="60" cy="86" rx="28" ry="22" fill="#ffa94d" />
      <ellipse cx="60" cy="92" rx="15" ry="12" fill="#ffe8cc" />
      <path d="M37 40 L41 16 L57 32Z M83 40 L79 16 L63 32Z" fill="#ffa94d" stroke="#f08a24" strokeWidth="2" strokeLinejoin="round" />
      <path d="M42 34 L44 23 L51 31Z M78 34 L76 23 L69 31Z" fill="#ffb3c1" />
      <circle cx="60" cy="52" r="25" fill="#ffa94d" />
      <path d="M52 30 q8 6 16 0 M50 36 q10 6 20 0" fill="none" stroke="#f08a24" strokeWidth="3" strokeLinecap="round" />
      <Eyes />
      <Blush />
      <path d="M57 58 L63 58 L60 61.5Z" fill="#ff6b81" />
      <path d="M54 63 q3 3.5 6 0 q3 3.5 6 0" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M30 56 h11 M30 61 l11 -2 M90 56 h-11 M90 61 l-11 -2" stroke={ink} strokeWidth="1.3" strokeLinecap="round" opacity=".6" />
      <ellipse cx="48" cy="106" rx="8" ry="5" fill="#ffa94d" /><ellipse cx="72" cy="106" rx="8" ry="5" fill="#ffa94d" />
    </g>
  </>
);

const BUNNY = (
  <>
    <Shadow />
    <g className="al-hop">
      <g className="al-earl"><ellipse cx="47" cy="22" rx="8" ry="22" fill="#fff" stroke="#e9e4ef" strokeWidth="2" /><ellipse cx="47" cy="24" rx="4" ry="15" fill="#ffc9d6" /></g>
      <g className="al-earr"><ellipse cx="73" cy="22" rx="8" ry="22" fill="#fff" stroke="#e9e4ef" strokeWidth="2" /><ellipse cx="73" cy="24" rx="4" ry="15" fill="#ffc9d6" /></g>
      <ellipse cx="60" cy="88" rx="27" ry="21" fill="#fff" stroke="#e9e4ef" strokeWidth="2" />
      <circle cx="86" cy="92" r="7" fill="#fff" stroke="#e9e4ef" strokeWidth="2" />
      <circle cx="60" cy="56" r="24" fill="#fff" stroke="#e9e4ef" strokeWidth="2" />
      <Eyes y={55} />
      <Blush y={63} />
      <ellipse cx="60" cy="62" rx="3" ry="2.2" fill="#ff8fa3" />
      <path d="M60 64 v3 M56 68 q4 3 8 0" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="57" y="68" width="6" height="5" rx="1.5" fill="#fff" stroke={ink} strokeWidth="1" />
      <ellipse cx="47" cy="107" rx="9" ry="5" fill="#fff" stroke="#e9e4ef" strokeWidth="2" /><ellipse cx="73" cy="107" rx="9" ry="5" fill="#fff" stroke="#e9e4ef" strokeWidth="2" />
    </g>
  </>
);

const PENGUIN = (
  <>
    <ellipse cx="60" cy="112" rx="22" ry="4" fill="#000" opacity=".18" />
    <g className="al-waddle">
      <path d="M50 108 l-8 3 h12z M70 108 l8 3 h-12z" fill="#ff922b" />
      <g className="al-flapl"><path d="M34 62 C22 72 22 88 28 94 C32 84 36 76 38 70Z" fill="#253858" /></g>
      <g className="al-flapr"><path d="M86 62 C98 72 98 88 92 94 C88 84 84 76 82 70Z" fill="#253858" /></g>
      <path d="M60 18 C84 18 90 46 90 74 C90 98 78 110 60 110 C42 110 30 98 30 74 C30 46 36 18 60 18Z" fill="#253858" />
      <path d="M60 38 C76 38 80 58 80 78 C80 96 72 104 60 104 C48 104 40 96 40 78 C40 58 44 38 60 38Z" fill="#fff" />
      <path d="M44 42 C50 34 70 34 76 42 C70 46 50 46 44 42Z" fill="#253858" />
      <Eyes y={50} dx={8} />
      <Blush y={58} dx={14} />
      <path d="M54 56 L66 56 L60 63Z" fill="#ff922b" stroke="#e8590c" strokeWidth="1" strokeLinejoin="round" />
      <path d="M50 22 q10 -8 20 0" fill="none" stroke="#ff6b6b" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="14" r="5" fill="#ff6b6b" />
    </g>
  </>
);

const DINO = (
  <>
    <ellipse cx="58" cy="112" rx="28" ry="4" fill="#000" opacity=".18" />
    <g className="al-bob">
      <g className="al-tail"><path d="M28 82 C14 82 8 72 6 64 C16 72 24 72 32 70Z" fill="#51cf66" /></g>
      <rect className="al-step1" x="40" y="92" width="11" height="18" rx="5" fill="#40c057" />
      <rect className="al-step2" x="62" y="92" width="11" height="18" rx="5" fill="#40c057" />
      <path d="M38 50 l4 -10 l5 9 l5 -11 l5 11 l6 -9 l3 10Z" fill="#fcc419" />
      <ellipse cx="56" cy="78" rx="30" ry="24" fill="#51cf66" />
      <ellipse cx="60" cy="86" rx="16" ry="12" fill="#d3f9d8" />
      <path d="M68 60 C66 40 76 28 92 30 C106 32 110 46 104 56 C98 66 84 66 76 66Z" fill="#51cf66" />
      <g className="al-blink"><ellipse cx="90" cy="42" rx="3.6" ry="4.6" fill={ink} /><circle cx="91.2" cy="40.4" r="1.2" fill="#fff" /></g>
      <ellipse cx="98" cy="52" rx="4" ry="2.5" fill="#ff8fa3" opacity=".6" />
      <path d="M86 56 q6 4 14 -1" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="104" cy="44" r="1.3" fill={ink} />
      <path d="M78 76 q6 2 8 -4" fill="none" stroke="#40c057" strokeWidth="5" strokeLinecap="round" />
    </g>
  </>
);

const GHOST = (
  <>
    <Shadow cls="al-floatshadow" />
    <g className="al-float">
      <path d="M60 18 C84 18 92 38 92 62 L92 96 q-6 8 -11 0 q-5 -8 -10 0 q-5 8 -11 0 q-5 -8 -10 0 q-5 8 -11 0 q-5 -8 -11 0 L28 62 C28 38 36 18 60 18Z" fill="#fff" stroke="#e4e1f0" strokeWidth="2" />
      <path d="M28 70 C20 70 16 62 20 58 C24 62 28 62 30 62Z M92 70 C100 70 104 62 100 58 C96 62 92 62 90 62Z" fill="#fff" stroke="#e4e1f0" strokeWidth="2" />
      <Eyes y={54} dx={10} />
      <Blush y={64} dx={18} />
      <ellipse cx="60" cy="68" rx="5" ry="6" fill={ink} /><ellipse cx="60" cy="71" rx="3" ry="2.5" fill="#ff6b81" />
      <path d="M72 26 q6 2 8 8" fill="none" stroke="#e4e1f0" strokeWidth="3" strokeLinecap="round" />
    </g>
  </>
);

const CHICK = (
  <>
    <Shadow />
    <g className="al-pop">
      <g className="al-flapl"><ellipse cx="38" cy="66" rx="8" ry="12" fill="#ffd43b" /></g>
      <g className="al-flapr"><ellipse cx="82" cy="66" rx="8" ry="12" fill="#ffd43b" /></g>
      <circle cx="60" cy="58" r="26" fill="#ffe066" />
      <path d="M56 32 q4 -12 8 0 q4 -10 6 2" fill="#ffd43b" stroke="#fab005" strokeWidth="1.5" />
      <Eyes y={54} />
      <Blush y={63} dx={17} />
      <path d="M54 60 L66 60 L60 67Z" fill="#ff922b" />
    </g>
    <path d="M30 84 L38 76 L46 86 L54 74 L62 86 L70 75 L78 86 L84 77 L90 84 C90 102 78 110 60 110 C42 110 30 102 30 84Z" fill="#fffaf0" stroke="#e9dfcf" strokeWidth="2" strokeLinejoin="round" />
    <path d="M42 96 l4 3 M74 98 l3 -3" stroke="#e9dfcf" strokeWidth="2" strokeLinecap="round" />
  </>
);

const BEAR = (
  <>
    <Shadow />
    <g className="al-bob">
      <circle cx="38" cy="30" r="11" fill="#a0673a" /><circle cx="38" cy="30" r="6" fill="#e8b98a" />
      <circle cx="82" cy="30" r="11" fill="#a0673a" /><circle cx="82" cy="30" r="6" fill="#e8b98a" />
      <ellipse cx="60" cy="90" rx="27" ry="21" fill="#a0673a" />
      <ellipse cx="60" cy="94" rx="15" ry="12" fill="#e8b98a" />
      <ellipse cx="38" cy="96" rx="8" ry="11" fill="#8c5631" />
      <g className="al-wave"><ellipse cx="88" cy="68" rx="8" ry="13" fill="#8c5631" /><ellipse cx="89" cy="60" rx="5" ry="4" fill="#e8b98a" /></g>
      <circle cx="60" cy="52" r="26" fill="#a0673a" />
      <ellipse cx="60" cy="62" rx="12" ry="9" fill="#e8b98a" />
      <Eyes y={50} dx={10} />
      <Blush y={60} dx={18} />
      <ellipse cx="60" cy="58" rx="4.5" ry="3.2" fill={ink} />
      <path d="M56 64 q4 4 8 0" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="48" cy="108" rx="9" ry="5" fill="#8c5631" /><ellipse cx="72" cy="108" rx="9" ry="5" fill="#8c5631" />
    </g>
  </>
);

const KRATHONG = (
  <>
    <circle className="al-glow" cx="60" cy="40" r="22" fill="#ffd43b" opacity=".5" />
    <g className="al-sway">
      <rect x="57" y="36" width="6" height="22" rx="2" fill="#fff4e6" stroke="#f1d8b8" strokeWidth="1" />
      <path className="al-flame" d="M60 22 C66 30 64 36 60 37 C56 36 54 30 60 22Z" fill="#ff922b" />
      <path className="al-flame" d="M60 28 C62.5 32 62 35 60 35.5 C58 35 57.5 32 60 28Z" fill="#ffe066" />
      <circle cx="44" cy="62" r="7" fill="#ff8fab" /><circle cx="44" cy="62" r="3" fill="#ffe066" />
      <circle cx="76" cy="62" r="7" fill="#f783ac" /><circle cx="76" cy="62" r="3" fill="#ffe066" />
      <circle cx="60" cy="64" r="6" fill="#ffc2d4" /><circle cx="60" cy="64" r="2.5" fill="#ffe066" />
      <path d="M26 72 L34 58 L40 72 L48 56 L54 72 L60 54 L66 72 L72 56 L80 72 L86 58 L94 72Z" fill="#40c057" stroke="#2b8a3e" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M22 72 H98 C96 86 82 92 60 92 C38 92 24 86 22 72Z" fill="#69db7c" stroke="#2b8a3e" strokeWidth="1.5" />
      <path d="M30 80 H90" stroke="#2b8a3e" strokeWidth="1.2" strokeDasharray="4 3" />
    </g>
    <g clipPath="url(#al-kclip)">
      <path className="al-water1" d="M-40 96 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V120 H-40Z" fill="#4dabf7" opacity=".55" />
      <path className="al-water2" d="M-40 102 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V120 H-40Z" fill="#339af0" opacity=".7" />
    </g>
    <defs><clipPath id="al-kclip"><rect x="0" y="80" width="120" height="40" /></clipPath></defs>
  </>
);

/** art = ตัวการ์ตูนที่วาดด้วย SVG · image = รูป/GIF เคลื่อนไหวในระบบ (public/addons — ต้องมีทั้งเว็บ OTP และ SysRent) */
export const BUILTIN_LOADERS: Record<string, { name: string; art?: React.ReactNode; image?: string }> = {
  cat: { name: 'ส้มจี๊ด แมวส้มกระโดด', art: CAT },
  bunny: { name: 'ปุยฝ้าย กระต่ายหูตั้ง', art: BUNNY },
  penguin: { name: 'ป๊อก เพนกวินเดินเตาะแตะ', art: PENGUIN },
  dino: { name: 'ไดโน่ ไดโนเสาร์จิ๋ว', art: DINO },
  ghost: { name: 'บูบู ผีน้อยขี้อาย', art: GHOST },
  chick: { name: 'เจี๊ยบ ลูกเจี๊ยบในเปลือกไข่', art: CHICK },
  bear: { name: 'โกโก้ หมีน้อยโบกมือ', art: BEAR },
  krathong: { name: 'กระทงน้อย ลอยน้ำ', art: KRATHONG },
  sleigh: { name: 'ซานต้าขี่เลื่อนกวางเรนเดียร์', image: '/addons/sleigh.webp' },
};

/** ตัวการ์ตูนรอโหลด: ตัวที่วาดในระบบ (code) หรือรูป/GIF ที่แอดมินอัป (imageUrl) */
export function LoaderArt({ code, imageUrl, size = 96, label }: { code?: string; imageUrl?: string; size?: number; label?: string }) {
  const b = code ? BUILTIN_LOADERS[code] : undefined;
  const img = b?.image ?? (!b ? imageUrl : undefined);
  if (img) {
    // รูปแนวนอน (เช่นซานต้าขี่เลื่อน) กว้างกว่าช่องสี่เหลี่ยม — ให้กว้างได้ 1.6 เท่า
    const w = b?.image ? Math.round(size * 1.6) : size;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt={label ?? b?.name ?? ''} width={w} height={size} style={{ width: w, height: size, objectFit: 'contain' }} />;
  }
  if (!b) return null;
  return (
    <svg className="al" viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={label ?? b.name}>
      <style>{LOADER_CSS}</style>
      {b.art}
    </svg>
  );
}

/* ====================================================================== */
/* ธีมพื้นหลัง + เอฟเฟกต์ตามเทศกาล (canvas)                                 */
/* ====================================================================== */

type Sprite = 'snow' | 'petal' | 'plum' | 'heart' | 'skylantern' | 'krathong' | 'coin' | 'drop' | 'flower' | 'bat' | 'confetti' | 'star' | 'pumpkin' | 'redlantern'
  | 'bubble' | 'leaf' | 'firefly' | 'cloud' | 'fish' | 'balloon' | 'bokeh';
/** ฉากที่วาดหลังเอฟเฟกต์ (ภูเขา ป่า ตึก ทะเล ฯลฯ) — ทำให้ธีมทั่วไปมีมิติ ไม่ใช่แค่สีพื้น */
type Scene = 'galaxy' | 'ocean' | 'aurora' | 'autumn' | 'forest' | 'pastel' | 'gold' | 'city';
type Motion = 'fall' | 'rise' | 'drift' | 'twinkle' | 'water' | 'hang' | 'bob';
type Layer = { sprite: Sprite; count: number; motion: Motion; size: [number, number]; speed: [number, number]; sway?: number; colors?: string[] };
/** image = รูปพื้นหลังแนวตั้ง (มือถือ) · imageWide = รูปแนวนอน (คอม — ไม่มี = ใช้รูปแนวตั้งเน้นช่วงกลางภาพ) · bg = สีพื้นรองรูป/พื้นหลังของธีมที่ไม่มีรูป */
export type ThemeDef = { name: string; emoji: string; bg: string; dark: boolean; layers: Layer[]; moon?: string; fireworks?: boolean; water?: boolean; scene?: Scene; image?: string; imageWide?: string; imageFocus?: string };

export const BUILTIN_THEMES: Record<string, ThemeDef> = {
  loykrathong: {
    // รูปวาด (พระจันทร์ วัด แม่น้ำ กระทง อยู่ในรูปแล้ว) + เอฟเฟกต์ขยับ: โคมลอยขึ้น ดาวกะพริบ แสงไฟระยิบบนน้ำ พลุ
    // ไฟล์รูปอยู่ใน public/addons/ ทั้งเว็บ OTP และ SysRent (ตัวอย่างในร้านฟังก์ชันเสริม)
    name: 'ลอยกระทง', emoji: '🪷', dark: true, fireworks: true, image: '/addons/loykrathong.jpg',
    bg: 'linear-gradient(180deg,#0a1235 0%,#18296a 55%,#22488a 100%)',
    layers: [
      { sprite: 'star', count: 30, motion: 'twinkle', size: [1, 2.4], speed: [0, 0] },
      { sprite: 'skylantern', count: 14, motion: 'rise', size: [14, 24], speed: [0.25, 0.55], sway: 0.6 },
      { sprite: 'firefly', count: 16, motion: 'drift', size: [2, 4], speed: [0.1, 0.3], sway: 0.6, colors: ['#ffe8a3', '#ffd43b', '#fff3bf'] },
    ],
  },
  newyear: {
    name: 'ปีใหม่ พลุ', emoji: '🎆', dark: true, fireworks: true,
    bg: 'linear-gradient(180deg,#0d0a26 0%,#24124a 60%,#3b1a5a 100%)',
    layers: [
      { sprite: 'star', count: 35, motion: 'twinkle', size: [1, 2.4], speed: [0, 0] },
      { sprite: 'confetti', count: 40, motion: 'fall', size: [5, 9], speed: [0.6, 1.4], sway: 1.2, colors: ['#ffd43b', '#ff6b6b', '#74c0fc', '#69db7c', '#f783ac', '#ffffff'] },
    ],
  },
  christmas: {
    // รูปวาด (ต้นคริสต์มาส ตุ๊กตาหิมะ บ้าน ภูเขา) + หิมะตก + ไฟประดับกะพริบ · รูปสว่าง → ตัวหนังสือสีเข้ม (dark: false)
    // จอคอมเน้นช่วง 52% ของภาพ (บ้าน ต้นคริสต์มาส ภูเขา) · ไฟล์ public/addons/christmas.jpg ทั้งเว็บ OTP และ SysRent
    name: 'คริสต์มาส หิมะ', emoji: '🎄', dark: false, image: '/addons/christmas.jpg', imageFocus: '52%',
    bg: 'linear-gradient(180deg,#a5c8f0 0%,#d6e4f5 55%,#f4f7fb 100%)',
    layers: [
      { sprite: 'firefly', count: 18, motion: 'twinkle', size: [2, 4], speed: [0, 0], colors: ['#ffd43b', '#ffe066', '#ff8787'] },
      { sprite: 'snow', count: 110, motion: 'fall', size: [1.6, 5.5], speed: [0.4, 1.2], sway: 0.8 },
    ],
  },
  xmasnight: {
    // ฉากหมู่บ้านหิมะยามค่ำ (บ้าน ตุ๊กตาหิมะ กวาง พระจันทร์ ซานต้า) — รูปเดียวกับพื้นหลังเว็บหลักช่วงคริสต์มาส
    // รูปแนวนอนรูปเดียว: มือถือตัดตรงกลางภาพ · ท้องฟ้าด้านบนเข้ม → ตัวหนังสือสีขาว (dark: true)
    name: 'คริสต์มาส คืนหิมะ', emoji: '🎅', dark: true, image: '/addons/xmas-night.webp', imageWide: '/addons/xmas-night.webp',
    bg: 'linear-gradient(180deg,#3b46b8 0%,#6d74d6 50%,#e9ecff 100%)',
    layers: [
      { sprite: 'firefly', count: 14, motion: 'twinkle', size: [2, 4], speed: [0, 0], colors: ['#ffd43b', '#ffe066', '#ff8787'] },
      { sprite: 'snow', count: 110, motion: 'fall', size: [1.6, 5.5], speed: [0.4, 1.2], sway: 0.8 },
    ],
  },
  chinese: {
    name: 'ตรุษจีน', emoji: '🧧', dark: true,
    bg: 'radial-gradient(circle at 50% 0%,#d9262e 0%,#9b1218 60%,#6f0b10 100%)',
    layers: [
      { sprite: 'redlantern', count: 5, motion: 'hang', size: [26, 36], speed: [0, 0] },
      { sprite: 'coin', count: 16, motion: 'fall', size: [9, 14], speed: [0.6, 1.3], sway: 0.4 },
      { sprite: 'plum', count: 20, motion: 'fall', size: [5, 8], speed: [0.4, 0.9], sway: 1 },
    ],
  },
  songkran: {
    name: 'สงกรานต์', emoji: '💦', dark: false,
    bg: 'linear-gradient(180deg,#d6f3ff 0%,#8fd8fb 55%,#4cc3f5 100%)',
    layers: [
      { sprite: 'drop', count: 55, motion: 'fall', size: [4, 8], speed: [2, 4], sway: 0.2 },
      { sprite: 'flower', count: 14, motion: 'fall', size: [9, 14], speed: [0.5, 1], sway: 1 },
    ],
  },
  valentine: {
    name: 'วาเลนไทน์', emoji: '💖', dark: false,
    bg: 'linear-gradient(180deg,#ffeef3 0%,#ffcadb 60%,#ffa3c4 100%)',
    layers: [{ sprite: 'heart', count: 30, motion: 'rise', size: [8, 18], speed: [0.4, 1], sway: 1, colors: ['#ff4d7d', '#ff8fab', '#e64980', '#ffffff'] }],
  },
  halloween: {
    name: 'ฮาโลวีน', emoji: '🎃', dark: true, moon: '#ffd8a8',
    bg: 'linear-gradient(180deg,#150d22 0%,#2a1838 60%,#47230f 100%)',
    layers: [
      { sprite: 'star', count: 30, motion: 'twinkle', size: [1, 2.2], speed: [0, 0] },
      { sprite: 'bat', count: 9, motion: 'drift', size: [20, 32], speed: [0.8, 1.6], sway: 1.5 },
      { sprite: 'pumpkin', count: 4, motion: 'bob', size: [22, 30], speed: [0, 0] },
    ],
  },
  sakura: {
    name: 'ซากุระบาน', emoji: '🌸', dark: false,
    bg: 'linear-gradient(180deg,#fff5f8 0%,#ffe1eb 60%,#fcc8dd 100%)',
    layers: [{ sprite: 'petal', count: 50, motion: 'fall', size: [6, 11], speed: [0.4, 1], sway: 1.4 }],
  },
  /* ---------- ธีมทั่วไป (ใช้ได้ทั้งปี ไม่ผูกเทศกาล) — มีฉากวาด (scene) + เอฟเฟกต์ขยับ ---------- */
  galaxy: {
    name: 'อวกาศ กาแล็กซี', emoji: '🌌', dark: true, scene: 'galaxy',
    bg: 'linear-gradient(180deg,#05040f 0%,#0f0a26 55%,#1a0f3a 100%)',
    layers: [
      { sprite: 'star', count: 90, motion: 'twinkle', size: [0.7, 2.2], speed: [0, 0], colors: ['#ffffff', '#d0bfff', '#a5d8ff', '#ffe8cc'] },
      { sprite: 'firefly', count: 12, motion: 'rise', size: [2, 4], speed: [0.08, 0.25], sway: 0.5, colors: ['#b197fc', '#74c0fc', '#f783ac'] },
    ],
  },
  ocean: {
    name: 'ใต้ทะเล', emoji: '🐠', dark: true, scene: 'ocean',
    bg: 'linear-gradient(180deg,#22b8cf 0%,#0c8599 30%,#0b5f83 65%,#073b5c 100%)',
    layers: [
      { sprite: 'fish', count: 9, motion: 'drift', size: [10, 18], speed: [0.4, 1], sway: 0.6, colors: ['#ff922b', '#ffd43b', '#f06595', '#74c0fc', '#69db7c'] },
      { sprite: 'bubble', count: 34, motion: 'rise', size: [2.5, 9], speed: [0.4, 1.1], sway: 0.8 },
    ],
  },
  aurora: {
    name: 'แสงเหนือ', emoji: '🌠', dark: true, scene: 'aurora',
    bg: 'linear-gradient(180deg,#020b16 0%,#06202f 55%,#0b3243 100%)',
    layers: [
      { sprite: 'star', count: 70, motion: 'twinkle', size: [0.7, 2], speed: [0, 0] },
      { sprite: 'snow', count: 26, motion: 'fall', size: [1, 2.6], speed: [0.2, 0.5], sway: 0.6 },
    ],
  },
  autumn: {
    name: 'ใบไม้ร่วง', emoji: '🍁', dark: false, scene: 'autumn',
    bg: 'linear-gradient(180deg,#ffe8cc 0%,#ffc078 45%,#ff922b 100%)',
    layers: [{ sprite: 'leaf', count: 30, motion: 'fall', size: [8, 14], speed: [0.5, 1.1], sway: 1.6, colors: ['#e8590c', '#f08c00', '#c92a2a', '#fab005', '#a6461a'] }],
  },
  firefly: {
    name: 'ป่าหิ่งห้อย', emoji: '✨', dark: true, scene: 'forest',
    bg: 'linear-gradient(180deg,#0b1f2a 0%,#0f2f2a 50%,#143d2b 100%)',
    layers: [
      { sprite: 'star', count: 40, motion: 'twinkle', size: [0.7, 1.8], speed: [0, 0] },
      { sprite: 'firefly', count: 40, motion: 'drift', size: [2.5, 5], speed: [0.15, 0.5], sway: 1.2, colors: ['#d8f5a2', '#ffe066', '#c0eb75'] },
    ],
  },
  pastel: {
    name: 'ท้องฟ้าพาสเทล', emoji: '🎈', dark: false, scene: 'pastel',
    bg: 'linear-gradient(180deg,#d0ebff 0%,#e5dbff 50%,#ffdeeb 100%)',
    layers: [
      { sprite: 'cloud', count: 6, motion: 'drift', size: [28, 46], speed: [0.12, 0.35] },
      { sprite: 'balloon', count: 9, motion: 'rise', size: [12, 18], speed: [0.35, 0.7], sway: 0.8, colors: ['#ff8fab', '#ffd43b', '#74c0fc', '#b197fc', '#63e6be'] },
      { sprite: 'star', count: 18, motion: 'twinkle', size: [1.4, 2.6], speed: [0, 0], colors: ['#ffffff', '#fff0f6'] },
    ],
  },
  gold: {
    name: 'ทองหรูหรา', emoji: '👑', dark: true, scene: 'gold',
    bg: 'radial-gradient(ellipse at 50% 0%,#4a3510 0%,transparent 65%),linear-gradient(180deg,#0e0b06 0%,#1c160b 60%,#2a1f0c 100%)',
    layers: [
      { sprite: 'bokeh', count: 14, motion: 'drift', size: [14, 34], speed: [0.08, 0.25], sway: 0.6, colors: ['#ffd43b', '#ffe8a3', '#f8c537'] },
      { sprite: 'star', count: 40, motion: 'twinkle', size: [1, 2.8], speed: [0, 0], colors: ['#ffe8a3', '#ffd43b', '#fff3bf'] },
      { sprite: 'confetti', count: 22, motion: 'fall', size: [3, 6], speed: [0.35, 0.8], sway: 1, colors: ['#ffd43b', '#f8c537', '#e0b13c', '#fff3bf'] },
    ],
  },
  rain: {
    name: 'ฝนพรำ เมืองยามค่ำ', emoji: '🌧️', dark: true, scene: 'city',
    bg: 'linear-gradient(180deg,#1b2735 0%,#2b3a4a 55%,#3d5166 100%)',
    layers: [{ sprite: 'drop', count: 90, motion: 'fall', size: [2.2, 4.5], speed: [3.5, 6], sway: 0.1 }],
  },
};

/** ธีมที่ใช้จริง: ธีมในระบบ หรือธีมที่แอดมินเพิ่ม (รูปพื้นหลัง + ยืมเอฟเฟกต์ของธีมในระบบ) */
export function resolveTheme(code: string, custom?: { image_url?: string; effect?: string; name?: string } | null): ThemeDef | null {
  const b = BUILTIN_THEMES[code];
  // ธีมในระบบที่แอดมินอัปรูปพื้นหลังไว้ = ใช้รูปนั้นแทนพื้นหลัง/ฉากที่วาด (โคม ดาว ฯลฯ ยังขยับเหมือนเดิม)
  // image_url = "รูปแนวตั้ง [เว้นวรรค] รูปแนวนอน" (แบบเดียวกับพื้นหลังร้าน) — แนวนอนไม่ใส่ก็ได้
  const [tall = '', wide = ''] = (custom?.image_url ?? '').trim().split(/\s+/);
  if (b && (tall || wide)) return { ...b, scene: undefined, moon: undefined, water: false, image: tall || wide, imageWide: wide || undefined };
  if (b) return b;
  if (!custom) return null;
  const fx = BUILTIN_THEMES[custom.effect ?? ''] ?? null;
  return {
    name: custom.name ?? 'ธีม', emoji: fx?.emoji ?? '✨', dark: fx?.dark ?? false,
    bg: fx?.bg ?? '#fff', image: tall || wide || undefined, imageWide: wide || undefined,
    layers: fx?.layers ?? [], moon: undefined, fireworks: fx?.fireworks, water: fx?.water,
  };
}

const cssUrl = (u: string) => `url("${u.replace(/["\\\n]/g, '')}")`;

/** สีพื้น/รูปย่อของธีม (ช่องเลือกธีม ตารางแอดมิน) */
export const themeSwatch = (t: ThemeDef | null | undefined) => (!t ? undefined : t.image ? `${cssUrl(t.image)} center 25% / cover no-repeat, ${t.bg}` : t.bg);

const BACKDROP_CSS = `.tb{inset:0;overflow:hidden;container-type:size;pointer-events:none;z-index:0}
.tb>i{position:absolute;inset:0;background:var(--tb-img) center top/cover no-repeat}
@container (min-aspect-ratio: 1/1){.tb>i{background-image:var(--tb-wide,var(--tb-img));background-position:var(--tb-pos)}}`;

/**
 * รูปพื้นหลังของธีม เต็มจอเสมอ — จอแนวตั้ง (มือถือ) ใช้รูปแนวตั้ง
 * จอแนวนอน (คอม): มีรูปแนวนอน = ใช้รูปนั้น · ไม่มี = รูปแนวตั้งเน้นช่วง imageFocus (ความสูงของภาพ เช่น 32% = วัด/แม่น้ำของลอยกระทง)
 * contained = เต็มกล่องแม่ (ตัวอย่าง) · ไม่ใส่ = เต็มจอ · วางก่อน EffectLayer (เอฟเฟกต์ขยับทับรูป)
 */
export function ThemeBackdrop({ theme, contained = false }: { theme: ThemeDef | null | undefined; contained?: boolean }) {
  const img = theme?.image;
  if (!img) return null;
  const wide = theme?.imageWide;
  return (
    <div className="tb" aria-hidden="true" style={{
      position: contained ? 'absolute' : 'fixed', ['--tb-img' as string]: cssUrl(img),
      ...(wide ? { ['--tb-wide' as string]: cssUrl(wide) } : {}), ['--tb-pos' as string]: wide ? 'center' : `center ${theme?.imageFocus ?? '32%'}`,
    }}>
      <style>{BACKDROP_CSS}</style>
      <i />
    </div>
  );
}

type P = { x: number; y: number; vx: number; vy: number; s: number; r: number; vr: number; ph: number; c: string; base: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; c: string };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function drawSprite(g: CanvasRenderingContext2D, sp: Sprite, p: P, t: number) {
  const s = p.s;
  g.save();
  g.translate(p.x, p.y);
  switch (sp) {
    case 'fish': {
      // ปลาหันตามทิศที่ว่าย · หางกระดิก
      g.scale(p.vx < 0 ? -1 : 1, 1);
      g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2); g.fill();
      const wag = Math.sin(t * 0.012 + p.ph) * s * 0.18;
      g.beginPath(); g.moveTo(-s * 0.85, 0); g.lineTo(-s * 1.55, -s * 0.5 + wag); g.lineTo(-s * 1.55, s * 0.5 + wag); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(s * 0.1, -s * 0.18, s * 0.45, s * 0.16, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 0.5, -s * 0.1, s * 0.16, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(s * 0.54, -s * 0.1, s * 0.08, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'balloon': {
      g.rotate(Math.sin(t * 0.0018 + p.ph) * 0.12);
      g.strokeStyle = 'rgba(80,80,110,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, s * 1.2); g.quadraticCurveTo(s * 0.4, s * 2.2, 0, s * 3.2); g.stroke();
      const gr = g.createRadialGradient(-s * 0.35, -s * 0.45, s * 0.1, 0, 0, s * 1.2);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, p.c); gr.addColorStop(1, p.c);
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, s, s * 1.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = p.c; g.beginPath(); g.moveTo(-s * 0.18, s * 1.18); g.lineTo(s * 0.18, s * 1.18); g.lineTo(0, s * 1.38); g.fill();
      break;
    }
    case 'bokeh': {
      g.globalAlpha = 0.12 + 0.18 * Math.abs(Math.sin(t * 0.0009 + p.ph));
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, s);
      gr.addColorStop(0, p.c); gr.addColorStop(0.7, p.c); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'bubble': {
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = Math.max(1, s * 0.12);
      g.fillStyle = 'rgba(255,255,255,.08)';
      g.beginPath(); g.arc(Math.sin(t * 0.003 + p.ph) * 2, 0, s, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(-s * 0.35, -s * 0.35, s * 0.22, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'leaf': {
      g.rotate(p.r); g.scale(1, Math.sin(t * 0.003 + p.ph) * 0.4 + 0.75);
      g.fillStyle = p.c; g.beginPath();
      g.moveTo(0, -s); g.quadraticCurveTo(s * 0.8, -s * 0.2, 0, s); g.quadraticCurveTo(-s * 0.8, -s * 0.2, 0, -s); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -s * 0.9); g.lineTo(0, s * 1.15); g.stroke();
      break;
    }
    case 'firefly': {
      g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.0025 + p.ph));
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, s * 2.4);
      gr.addColorStop(0, p.c === '#fff' ? '#fff9db' : p.c); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * 2.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, s * 0.35, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'cloud': {
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath();
      g.arc(-s * 0.55, s * 0.1, s * 0.45, 0, Math.PI * 2); g.arc(0, -s * 0.15, s * 0.6, 0, Math.PI * 2);
      g.arc(s * 0.6, s * 0.1, s * 0.42, 0, Math.PI * 2); g.rect(-s * 0.55, 0, s * 1.15, s * 0.55); g.fill();
      break;
    }
    case 'snow': {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, s);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'star': {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.002 + p.ph));
      g.globalAlpha = a; g.fillStyle = p.c;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.35 : s * 1.6; const an = (i * Math.PI) / 4; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
      g.closePath(); g.fill();
      break;
    }
    case 'petal': case 'plum': {
      g.rotate(p.r); g.scale(Math.sin(t * 0.003 + p.ph), 1);
      g.fillStyle = sp === 'petal' ? p.c || '#ffb7cf' : '#ffd6e5';
      g.beginPath(); g.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-s * 0.25, -s * 0.15, s * 0.4, s * 0.2, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'heart': {
      g.rotate(Math.sin(t * 0.002 + p.ph) * 0.3);
      g.fillStyle = p.c; g.beginPath();
      g.moveTo(0, s * 0.35);
      g.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.45);
      g.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
      g.fill();
      break;
    }
    case 'skylantern': {
      const fl = 0.75 + 0.25 * Math.sin(t * 0.012 + p.ph);
      g.shadowColor = 'rgba(255,170,60,.9)'; g.shadowBlur = s * 1.4 * fl;
      const gr = g.createLinearGradient(0, -s, 0, s);
      gr.addColorStop(0, '#ffcf6b'); gr.addColorStop(1, '#ff8a1f');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-s * 0.55, -s); g.lineTo(s * 0.55, -s); g.lineTo(s * 0.42, s * 0.8); g.quadraticCurveTo(0, s, -s * 0.42, s * 0.8); g.closePath(); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = `rgba(255,240,180,${fl})`; g.beginPath(); g.ellipse(0, s * 0.7, s * 0.18, s * 0.26, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'krathong': {
      g.rotate(Math.sin(t * 0.002 + p.ph) * 0.06);
      const fl = 0.8 + 0.2 * Math.sin(t * 0.02 + p.ph);
      g.shadowColor = 'rgba(255,190,80,.9)'; g.shadowBlur = s * 0.9 * fl;
      g.fillStyle = '#fff4e6'; g.fillRect(-s * 0.05, -s * 0.85, s * 0.1, s * 0.45);
      g.fillStyle = '#ffb02e'; g.beginPath(); g.ellipse(0, -s * 0.95, s * 0.07 * fl, s * 0.14 * fl, 0, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#3fb950';
      g.beginPath(); g.moveTo(-s * 0.7, -s * 0.15);
      for (let i = 0; i <= 6; i++) g.lineTo(-s * 0.7 + (i * s * 1.4) / 6, i % 2 ? -s * 0.15 : -s * 0.5);
      g.lineTo(s * 0.7, -s * 0.15); g.closePath(); g.fill();
      g.fillStyle = '#ff8fab'; g.beginPath(); g.arc(-s * 0.3, -s * 0.3, s * 0.13, 0, Math.PI * 2); g.arc(s * 0.3, -s * 0.3, s * 0.13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#69db7c'; g.beginPath(); g.moveTo(-s * 0.8, -s * 0.15); g.lineTo(s * 0.8, -s * 0.15); g.quadraticCurveTo(s * 0.6, s * 0.25, 0, s * 0.25); g.quadraticCurveTo(-s * 0.6, s * 0.25, -s * 0.8, -s * 0.15); g.fill();
      break;
    }
    case 'coin': {
      g.scale(Math.cos(t * 0.004 + p.ph), 1);
      g.fillStyle = '#f5b301'; g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd43b'; g.beginPath(); g.arc(0, 0, s * 0.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c47f00'; g.fillRect(-s * 0.25, -s * 0.25, s * 0.5, s * 0.5);
      break;
    }
    case 'drop': {
      const gr = g.createLinearGradient(0, -s * 2, 0, s);
      gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,.95)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -s * 2); g.quadraticCurveTo(s, 0, 0, s); g.quadraticCurveTo(-s, 0, 0, -s * 2); g.fill();
      break;
    }
    case 'flower': {
      g.rotate(p.r);
      g.fillStyle = '#fffdf7';
      for (let i = 0; i < 5; i++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, -s * 0.55, s * 0.32, s * 0.6, 0.35, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffd43b'; g.beginPath(); g.arc(0, 0, s * 0.28, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'bat': {
      const w = Math.sin(t * 0.02 + p.ph);
      // ตัดขอบด้วยแสงจันทร์ ให้เห็นบนฟ้ามืด
      g.shadowColor = 'rgba(255,190,120,.55)'; g.shadowBlur = s * 0.35;
      g.fillStyle = '#120a18';
      g.beginPath(); g.ellipse(0, 0, s * 0.22, s * 0.3, 0, 0, Math.PI * 2); g.fill();
      for (const d of [-1, 1]) {
        g.beginPath(); g.moveTo(0, 0);
        g.quadraticCurveTo(d * s * 0.6, -s * 0.7 * w, d * s * 1.1, -s * 0.2 * w);
        g.quadraticCurveTo(d * s * 0.8, s * 0.1, d * s * 0.55, s * 0.05);
        g.quadraticCurveTo(d * s * 0.35, s * 0.25, 0, 0); g.fill();
      }
      g.shadowBlur = 0;
      g.fillStyle = '#ffd43b'; g.fillRect(-s * 0.1, -s * 0.12, s * 0.06, s * 0.06); g.fillRect(s * 0.04, -s * 0.12, s * 0.06, s * 0.06);
      break;
    }
    case 'confetti': {
      g.rotate(p.r); g.scale(1, Math.sin(t * 0.006 + p.ph));
      g.fillStyle = p.c; g.fillRect(-s / 2, -s / 4, s, s / 2);
      break;
    }
    case 'pumpkin': {
      g.translate(0, Math.sin(t * 0.0025 + p.ph) * 3);
      g.shadowColor = 'rgba(255,140,0,.7)'; g.shadowBlur = s * 0.6;
      g.fillStyle = '#ff7b00';
      for (const dx of [-0.42, 0, 0.42]) { g.beginPath(); g.ellipse(dx * s, 0, s * 0.45, s * 0.6, 0, 0, Math.PI * 2); g.fill(); }
      g.shadowBlur = 0;
      g.fillStyle = '#2b8a3e'; g.fillRect(-s * 0.06, -s * 0.8, s * 0.12, s * 0.25);
      g.fillStyle = '#ffe066';
      g.beginPath(); g.moveTo(-s * 0.4, -s * 0.12); g.lineTo(-s * 0.2, -s * 0.3); g.lineTo(-s * 0.1, -s * 0.08); g.fill();
      g.beginPath(); g.moveTo(s * 0.4, -s * 0.12); g.lineTo(s * 0.2, -s * 0.3); g.lineTo(s * 0.1, -s * 0.08); g.fill();
      g.beginPath(); g.moveTo(-s * 0.35, s * 0.15); g.lineTo(-s * 0.15, s * 0.3); g.lineTo(0, s * 0.18); g.lineTo(s * 0.15, s * 0.3); g.lineTo(s * 0.35, s * 0.15); g.quadraticCurveTo(0, s * 0.45, -s * 0.35, s * 0.15); g.fill();
      break;
    }
    case 'redlantern': {
      g.strokeStyle = 'rgba(255,215,0,.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -p.y); g.lineTo(0, -s * 0.7); g.stroke();
      g.rotate(Math.sin(t * 0.0018 + p.ph) * 0.12);
      g.shadowColor = 'rgba(255,60,40,.8)'; g.shadowBlur = s * 0.8;
      g.fillStyle = '#e8222b'; g.beginPath(); g.ellipse(0, 0, s * 0.62, s * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,200,60,.65)'; g.lineWidth = 1.2;
      for (const k of [-0.32, 0, 0.32]) { g.beginPath(); g.ellipse(0, 0, Math.abs(k) * s * 1.2 + 0.5, s * 0.5, 0, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#ffd43b'; g.fillRect(-s * 0.3, -s * 0.6, s * 0.6, s * 0.14); g.fillRect(-s * 0.3, s * 0.46, s * 0.6, s * 0.14);
      g.strokeStyle = '#ffd43b'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, s * 0.6); g.lineTo(0, s * 0.95); g.stroke();
      break;
    }
  }
  g.restore();
}

/* ---------- ฉากของธีมทั่วไป (วาดทุกเฟรมก่อนเอฟเฟกต์) ---------- */
type SceneState = {
  shoot: { x: number; y: number; vx: number; vy: number; life: number }[]; nextShoot: number;
  flash: number; nextFlash: number;
  ripples: { x: number; y: number; r: number; life: number }[];
};
export const newSceneState = (): SceneState => ({ shoot: [], nextShoot: 0, flash: 0, nextFlash: 0, ripples: [] });

/** สุ่มแบบคงที่ตามเลข (ตึก/ต้นไม้อยู่ที่เดิมทุกเฟรม) */
const sr = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** แนวเนิน/ภูเขา: amp = ความสูงคลื่น · jag = ภูเขายอดแหลม */
function ridge(g: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, freq: number, seed: number, color: string | CanvasGradient, jag = false) {
  g.fillStyle = color; g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w + 8; x += 8) {
    const a = Math.sin(x * freq + seed) + 0.45 * Math.sin(x * freq * 2.3 + seed * 1.7) + 0.2 * Math.sin(x * freq * 5.1 + seed * 2.9);
    g.lineTo(x, base - (jag ? Math.abs(a) * amp * 1.3 : a * amp));
  }
  g.lineTo(w, h); g.closePath(); g.fill();
}
function ridgeY(x: number, base: number, amp: number, freq: number, seed: number) {
  const a = Math.sin(x * freq + seed) + 0.45 * Math.sin(x * freq * 2.3 + seed * 1.7) + 0.2 * Math.sin(x * freq * 5.1 + seed * 2.9);
  return base - a * amp;
}
function pine(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.fillStyle = color;
  for (let k = 0; k < 3; k++) {
    const ty = y - s * (0.55 + k * 0.6), hw = s * (0.55 - k * 0.13);
    g.beginPath(); g.moveTo(x, ty - s * 0.75); g.lineTo(x + hw, ty + s * 0.35); g.lineTo(x - hw, ty + s * 0.35); g.closePath(); g.fill();
  }
  g.fillRect(x - s * 0.06, y - s * 0.4, s * 0.12, s * 0.4);
}
function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer = 'rgba(255,255,255,0)') {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

function drawScene(g: CanvasRenderingContext2D, scene: Scene, w: number, h: number, t: number, dt: number, sc: SceneState, still: boolean) {
  const m = Math.min(w, h);
  g.save();
  switch (scene) {
    case 'galaxy': {
      // เนบิวลาเคลื่อนช้า ๆ
      const neb: [number, number, number, string][] = [[0.28, 0.25, 0.55, 'rgba(151,117,250,.32)'], [0.75, 0.45, 0.5, 'rgba(56,189,248,.22)'], [0.45, 0.7, 0.45, 'rgba(240,101,149,.2)']];
      neb.forEach(([x, y, r, c], i) => glow(g, w * (x + 0.04 * Math.sin(t * 0.00012 + i * 2)), h * (y + 0.03 * Math.cos(t * 0.0001 + i)), m * r, c));
      // ดาวเคราะห์มีวงแหวน
      const px = w * 0.83, py = h * 0.8, pr = m * 0.13;
      glow(g, px, py, pr * 2, 'rgba(255,169,77,.25)');
      // วงแหวน: ครึ่งหลังวาดก่อนดาว ครึ่งหน้าวาดทับ (ดูเป็นวงรอบดาวจริง)
      g.strokeStyle = 'rgba(255,224,170,.7)'; g.lineWidth = Math.max(2, pr * 0.08);
      g.beginPath(); g.ellipse(px, py, pr * 1.8, pr * 0.45, -0.35, Math.PI, Math.PI * 2); g.stroke();
      const pg = g.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
      pg.addColorStop(0, '#ffc078'); pg.addColorStop(0.5, '#e8590c'); pg.addColorStop(1, '#5f3dc4');
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(px, py, pr * 1.8, pr * 0.45, -0.35, 0, Math.PI); g.stroke();
      // ดาวตก
      if (!still && t > sc.nextShoot) {
        sc.shoot.push({ x: Math.random() * w * 0.7, y: Math.random() * h * 0.35, vx: 7 + Math.random() * 5, vy: 3 + Math.random() * 2, life: 1 });
        sc.nextShoot = t + 1500 + Math.random() * 3000;
      }
      for (let i = sc.shoot.length - 1; i >= 0; i--) {
        const s = sc.shoot[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= 0.02 * dt;
        if (s.life <= 0) { sc.shoot.splice(i, 1); continue; }
        const tg = g.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12);
        tg.addColorStop(0, `rgba(255,255,255,${s.life})`); tg.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = tg; g.lineWidth = 2; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 12, s.y - s.vy * 12); g.stroke();
      }
      break;
    }
    case 'ocean': {
      // ลำแสงส่องลงใต้น้ำ
      for (let i = 0; i < 6; i++) {
        const x = w * (0.08 + i * 0.17) + Math.sin(t * 0.0004 + i) * 30;
        const a = 0.05 + 0.07 * Math.abs(Math.sin(t * 0.0006 + i * 1.3));
        const gr = g.createLinearGradient(0, 0, 0, h * 0.8);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 20, 0); g.lineTo(x + 30, 0); g.lineTo(x + 140, h * 0.8); g.lineTo(x - 30, h * 0.8); g.closePath(); g.fill();
      }
      // พื้นทราย + หิน
      ridge(g, w, h, h * 0.86, h * 0.025, 0.006, 1.2, '#0a4d68');
      ridge(g, w, h, h * 0.93, h * 0.02, 0.009, 4.1, '#c9a46b');
      // สาหร่ายโบก + ปะการัง
      const n = Math.max(6, Math.round(w / 70));
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (w / n) + (sr(i) - 0.5) * 40, base = h * 0.95, len = h * (0.12 + sr(i + 9) * 0.14);
        const sway = Math.sin(t * 0.0015 + i) * 18;
        g.strokeStyle = sr(i + 3) > 0.5 ? '#2b8a3e' : '#37b24d'; g.lineWidth = 5 + sr(i + 5) * 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + sway, base - len * 0.5, x + sway * 1.6, base - len); g.stroke();
        if (sr(i + 7) > 0.55) {
          const c = sr(i + 11) > 0.5 ? '#ff8787' : '#ffa94d';
          g.fillStyle = c;
          for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + 12 + k * 9, base - 10 - (k % 2) * 9, 8 - k, 0, Math.PI * 2); g.fill(); }
        }
      }
      break;
    }
    case 'aurora': {
      // ม่านแสงเหนือพลิ้ว
      const bands: [number, string, string][] = [[0.18, 'rgba(56,217,169,.32)', 'rgba(56,217,169,.9)'], [0.26, 'rgba(151,117,250,.25)', 'rgba(177,151,252,.8)'], [0.34, 'rgba(99,230,190,.22)', 'rgba(150,242,215,.7)']];
      g.globalCompositeOperation = 'lighter';
      bands.forEach(([y, c1, c2], i) => {
        g.beginPath();
        for (let x = -20; x <= w + 20; x += 12) {
          const yy = h * y + Math.sin(x * 0.004 + t * 0.0005 * (i + 1) + i * 2) * h * 0.06 + Math.sin(x * 0.011 + t * 0.0009) * h * 0.015;
          if (x === -20) g.moveTo(x, yy); else g.lineTo(x, yy);
        }
        g.strokeStyle = c1; g.lineWidth = h * 0.09; g.shadowColor = c2; g.shadowBlur = 40; g.stroke();
        g.strokeStyle = c2; g.lineWidth = 2; g.shadowBlur = 12; g.stroke();
      });
      g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0;
      // ภูเขาหิมะ + ทะเลสาบ
      const sg = g.createLinearGradient(0, h * 0.55, 0, h * 0.75);
      sg.addColorStop(0, '#e7f5ff'); sg.addColorStop(0.25, '#5c7c99'); sg.addColorStop(1, '#16324a');
      ridge(g, w, h, h * 0.74, h * 0.12, 0.004, 2.3, sg, true);
      ridge(g, w, h, h * 0.82, h * 0.06, 0.007, 5.2, '#0b2233', true);
      const lg = g.createLinearGradient(0, h * 0.86, 0, h);
      lg.addColorStop(0, 'rgba(56,217,169,.18)'); lg.addColorStop(1, 'rgba(4,20,32,.9)');
      g.fillStyle = lg; g.fillRect(0, h * 0.86, w, h * 0.14);
      break;
    }
    case 'autumn': {
      glow(g, w * 0.72, h * 0.3, m * 0.45, 'rgba(255,243,191,.9)');
      g.fillStyle = '#ffd43b'; g.beginPath(); g.arc(w * 0.72, h * 0.3, m * 0.08, 0, Math.PI * 2); g.fill();
      ridge(g, w, h, h * 0.68, h * 0.05, 0.0035, 0.7, '#f4a261');
      // ต้นไม้ใบส้มบนเนินกลาง
      const n = Math.max(5, Math.round(w / 110));
      ridge(g, w, h, h * 0.78, h * 0.04, 0.005, 3.3, '#e76f51');
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (w / n) + (sr(i + 20) - 0.5) * 50, y = ridgeY(x, h * 0.78, h * 0.04, 0.005, 3.3), s = m * (0.05 + sr(i + 30) * 0.04);
        const sway = Math.sin(t * 0.0012 + i) * s * 0.06;
        g.fillStyle = '#6b3a1f'; g.fillRect(x - s * 0.08, y - s * 0.9, s * 0.16, s * 0.95);
        const cols = ['#d9480f', '#e8590c', '#f08c00', '#c92a2a'];
        g.fillStyle = cols[i % cols.length];
        for (const [dx, dy, r] of [[0, -1.25, 0.6], [-0.35, -0.95, 0.42], [0.38, -0.98, 0.45]]) {
          g.beginPath(); g.arc(x + s * dx + sway, y + s * dy, s * r, 0, Math.PI * 2); g.fill();
        }
      }
      ridge(g, w, h, h * 0.9, h * 0.03, 0.006, 6.1, '#9c4221');
      break;
    }
    case 'forest': {
      glow(g, w * 0.2, h * 0.16, m * 0.3, 'rgba(233,250,200,.45)');
      g.fillStyle = '#f4fce3'; g.beginPath(); g.arc(w * 0.2, h * 0.16, m * 0.055, 0, Math.PI * 2); g.fill();
      ridge(g, w, h, h * 0.7, h * 0.04, 0.004, 1.9, '#163d2c');
      const back = Math.round(w / 34);
      for (let i = 0; i < back; i++) { const x = i * 34 + sr(i) * 20; pine(g, x, ridgeY(x, h * 0.7, h * 0.04, 0.004, 1.9) + 4, m * (0.06 + sr(i + 40) * 0.04), '#1b4332'); }
      ridge(g, w, h, h * 0.85, h * 0.03, 0.006, 4.4, '#0b2219');
      const front = Math.round(w / 70);
      for (let i = 0; i < front; i++) { const x = i * 70 + sr(i + 60) * 40; pine(g, x, ridgeY(x, h * 0.85, h * 0.03, 0.006, 4.4) + 6, m * (0.11 + sr(i + 80) * 0.06), '#071a12'); }
      // หญ้าไหว
      g.strokeStyle = '#06140d'; g.lineWidth = 2;
      for (let x = 0; x < w; x += 7) {
        const len = 12 + sr(x) * 16, sway = Math.sin(t * 0.002 + x * 0.05) * 5;
        g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + sway * 0.5, h - len * 0.5, x + sway, h - len); g.stroke();
      }
      break;
    }
    case 'pastel': {
      glow(g, w * 0.8, h * 0.15, m * 0.35, 'rgba(255,244,214,.95)');
      // รุ้งจาง ๆ
      const rc = ['rgba(255,135,135,.22)', 'rgba(255,192,120,.22)', 'rgba(255,236,153,.22)', 'rgba(140,233,154,.2)', 'rgba(116,192,252,.2)', 'rgba(177,151,252,.2)'];
      g.lineWidth = m * 0.035;
      rc.forEach((c, i) => { g.strokeStyle = c; g.beginPath(); g.arc(w * 0.25, h * 0.95, m * (0.75 - i * 0.035), Math.PI, Math.PI * 2); g.stroke(); });
      ridge(g, w, h, h * 0.84, h * 0.04, 0.004, 2.2, '#d3f9d8');
      ridge(g, w, h, h * 0.92, h * 0.03, 0.006, 5.5, '#c3fae8');
      break;
    }
    case 'gold': {
      // ลำแสงทองหมุนช้า ๆ จากด้านบน
      const cx = w / 2, cy = -h * 0.05, R = Math.hypot(w, h);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI + t * 0.00004, sp = 0.05;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
        gr.addColorStop(0, `rgba(255,212,59,${0.1 + 0.05 * Math.sin(t * 0.0007 + i)})`); gr.addColorStop(0.6, 'rgba(255,212,59,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a - sp) * R, cy + Math.sin(a - sp) * R); g.lineTo(cx + Math.cos(a + sp) * R, cy + Math.sin(a + sp) * R); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      const fg = g.createLinearGradient(0, h * 0.8, 0, h);
      fg.addColorStop(0, 'rgba(255,212,59,0)'); fg.addColorStop(1, 'rgba(255,212,59,.18)');
      g.fillStyle = fg; g.fillRect(0, h * 0.8, w, h * 0.2);
      break;
    }
    case 'city': {
      // ฟ้าแลบ
      if (!still && t > sc.nextFlash) { sc.flash = 1; sc.nextFlash = t + 6000 + Math.random() * 9000; }
      if (sc.flash > 0) { g.fillStyle = `rgba(220,230,255,${sc.flash * 0.35})`; g.fillRect(0, 0, w, h); sc.flash -= 0.04 * dt; }
      // ตึก 2 ชั้น + ไฟหน้าต่าง
      const city = (base: number, minH: number, maxH: number, bw: number, color: string, seed: number, lit: boolean) => {
        let x = -10, i = 0;
        while (x < w + 10) {
          const bwid = bw * (0.7 + sr(seed + i) * 0.8), bh = minH + sr(seed + i + 100) * (maxH - minH);
          g.fillStyle = color; g.fillRect(x, base - bh, bwid - 3, bh + 2);
          if (lit) {
            for (let wy = base - bh + 8; wy < base - 8; wy += 12) {
              for (let wx = x + 5; wx < x + bwid - 10; wx += 9) {
                const k = Math.floor(wx * 7 + wy * 13 + seed);
                if (sr(k) < 0.42) continue;
                const flick = sr(k + 5) > 0.97 ? 0.3 + 0.7 * Math.abs(Math.sin(t * 0.003 + k)) : 1;
                g.fillStyle = `rgba(255,${200 + Math.round(sr(k + 2) * 40)},120,${0.75 * flick})`; g.fillRect(wx, wy, 4, 6);
              }
            }
          }
          x += bwid; i++;
        }
      };
      city(h * 0.86, h * 0.18, h * 0.42, 70, '#2c3e50', 1, false);
      city(h * 0.92, h * 0.12, h * 0.34, 60, '#141e2a', 50, true);
      const wg = g.createLinearGradient(0, h * 0.92, 0, h);
      wg.addColorStop(0, '#1d2a38'); wg.addColorStop(1, '#0d141d');
      g.fillStyle = wg; g.fillRect(0, h * 0.92, w, h * 0.08);
      // วงน้ำกระเพื่อม
      if (!still && Math.random() < 0.25 * dt) sc.ripples.push({ x: Math.random() * w, y: h * (0.94 + Math.random() * 0.05), r: 1, life: 1 });
      g.strokeStyle = 'rgba(180,200,230,.5)'; g.lineWidth = 1;
      for (let i = sc.ripples.length - 1; i >= 0; i--) {
        const r = sc.ripples[i]; r.r += 0.6 * dt; r.life -= 0.025 * dt;
        if (r.life <= 0) { sc.ripples.splice(i, 1); continue; }
        g.globalAlpha = r.life; g.beginPath(); g.ellipse(r.x, r.y, r.r * 2.2, r.r * 0.6, 0, 0, Math.PI * 2); g.stroke();
      }
      break;
    }
  }
  g.restore();
}

/**
 * ชั้นเอฟเฟกต์ (วาดหลังเนื้อหา) — contained = เต็มกล่องแม่ (ใช้ในตัวอย่าง) · ไม่ใส่ = เต็มจอ
 * หยุดวาดตอนแท็บถูกซ่อน · ผู้ใช้ตั้ง "ลดการเคลื่อนไหว" = ภาพนิ่ง
 */
export function EffectLayer({ theme, contained = false }: { theme: ThemeDef; contained?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let w = 0, h = 0, raf = 0, last = 0;
    let groups: { layer: Layer; ps: P[] }[] = [];
    const sparks: Spark[] = [];
    let nextBoom = 0;
    const sc = newSceneState();

    const spawn = (L: Layer, init: boolean): P => {
      const s = rnd(L.size[0], L.size[1]);
      const sp = rnd(L.speed[0], L.speed[1]);
      const c = L.colors ? pick(L.colors) : L.sprite === 'star' ? '#fffbe6' : L.sprite === 'petal' ? pick(['#ffb7cf', '#ffc9da', '#ff9fbe']) : '#fff';
      const p: P = { x: rnd(0, w), y: 0, vx: 0, vy: sp, s, r: rnd(0, Math.PI * 2), vr: rnd(-0.02, 0.02), ph: rnd(0, 1000), c, base: 0 };
      switch (L.motion) {
        case 'fall': p.y = init ? rnd(-h * 0.15, h) : rnd(-60, -10); break;
        case 'rise': p.y = init ? rnd(h * 0.1, h * 1.1) : h + rnd(10, 60); break;
        case 'twinkle': p.y = rnd(0, h * 0.75); break;
        case 'drift': p.y = rnd(h * 0.08, h * 0.55); p.base = p.y; p.vx = sp * (Math.random() < 0.5 ? -1 : 1); p.x = init ? rnd(0, w) : p.vx > 0 ? -40 : w + 40; break;
        case 'water': p.y = h - rnd(14, 34); p.base = p.y; p.vx = sp * (Math.random() < 0.5 ? -1 : 1); p.x = init ? rnd(0, w) : p.vx > 0 ? -40 : w + 40; break;
        case 'bob': p.y = h - rnd(18, 30); break;
        case 'hang': p.y = rnd(40, 90); break;
      }
      return p;
    };

    const resize = () => {
      const box = contained ? cv.parentElement?.getBoundingClientRect() : null;
      w = Math.max(1, Math.round(box ? box.width : window.innerWidth));
      h = Math.max(1, Math.round(box ? box.height : window.innerHeight));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // จอเล็ก (มือถือ) = ลดจำนวนลง
      const k = Math.max(0.55, Math.min(1, (w * h) / (1280 * 800)));
      groups = theme.layers.map((L) => {
        const n = L.motion === 'hang' || L.motion === 'bob' ? Math.max(2, Math.round(L.count * Math.min(1, w / 900) + 1)) : Math.max(3, Math.round(L.count * k));
        const ps = Array.from({ length: n }, () => spawn(L, true));
        if (L.motion === 'hang' || L.motion === 'bob') ps.forEach((p, i) => { p.x = ((i + 0.5) * w) / n + rnd(-12, 12); });
        return { layer: L, ps };
      });
    };

    const boom = () => {
      const x = rnd(w * 0.15, w * 0.85), y = rnd(h * 0.12, h * 0.45);
      const c = pick(['#ffd43b', '#ff6b6b', '#74c0fc', '#b197fc', '#69db7c', '#ff922b', '#f783ac']);
      const n = w < 600 ? 36 : 60;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, v = rnd(1.2, 3.4);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c });
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(3, last ? (t - last) / 16.7 : 1);
      last = t;
      g.clearRect(0, 0, w, h);
      if (theme.scene) drawScene(g, theme.scene, w, h, t, dt, sc, reduce);
      if (theme.moon) {
        const mx = w * 0.82, my = Math.min(110, h * 0.16), mr = Math.min(46, w * 0.08);
        g.save(); g.shadowColor = theme.moon; g.shadowBlur = mr * 1.3; g.fillStyle = theme.moon;
        g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill(); g.restore();
      }
      if (theme.water) {
        const gr = g.createLinearGradient(0, h - 50, 0, h);
        gr.addColorStop(0, 'rgba(70,130,220,0)'); gr.addColorStop(1, 'rgba(40,90,190,.55)');
        g.fillStyle = gr; g.fillRect(0, h - 50, w, 50);
      }
      for (const { layer: L, ps } of groups) {
        for (let i = 0; i < ps.length; i++) {
          const p = ps[i];
          if (!reduce) {
            const sway = (L.sway ?? 0) * Math.sin(t * 0.0015 + p.ph);
            switch (L.motion) {
              case 'fall': p.y += p.vy * dt; p.x += sway * dt * 0.6; p.r += p.vr * dt; if (p.y > h + 30) ps[i] = spawn(L, false); break;
              case 'rise': p.y -= p.vy * dt; p.x += sway * dt * 0.4; if (p.y < -40) ps[i] = spawn(L, false); break;
              case 'drift': case 'water':
                p.x += p.vx * dt; p.y = p.base + Math.sin(t * 0.002 + p.ph) * (L.motion === 'water' ? 2 : 14);
                if (p.x < -60 || p.x > w + 60) ps[i] = spawn(L, false);
                break;
            }
          }
          drawSprite(g, L.sprite, ps[i], reduce ? 0 : t);
        }
      }
      if (theme.fireworks && !reduce) {
        if (t > nextBoom) { boom(); nextBoom = t + rnd(700, 1500); }
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.035 * dt; s.vx *= 0.985; s.life -= 0.012 * dt;
          if (s.life <= 0) { sparks.splice(i, 1); continue; }
          g.globalAlpha = Math.max(0, s.life); g.fillStyle = s.c;
          g.beginPath(); g.arc(s.x, s.y, 1.8, 0, Math.PI * 2); g.fill();
        }
        g.restore();
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = contained && cv.parentElement ? new ResizeObserver(resize) : null;
    if (ro && cv.parentElement) ro.observe(cv.parentElement); else window.addEventListener('resize', resize);
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', vis);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect(); window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [theme, contained]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: contained ? 'absolute' : 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />;
}
