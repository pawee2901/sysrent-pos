import { ImageResponse } from 'next/og';
import { getShop } from '@/lib/shop';
import { accentHex } from '@/lib/colors';

/** ไอคอนแอปร้าน (PNG): โลโก้ร้านบนพื้นขาว · ไม่มีโลโก้ = รูปถุงช้อปปิ้งบนสีร้าน
 *  ?size=96|192|512 · pad=1 = เว้นขอบสำหรับไอคอนแบบ maskable (Android ตัดเป็นวงกลม) */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const size = [96, 192, 512].includes(Number(q.get('size'))) ? Number(q.get('size')) : 192;
  const pad = q.get('pad') === '1' ? Math.round(size * 0.18) : Math.round(size * 0.08);
  const shop = await getShop();
  const color = shop ? accentHex(shop.accent) : '#5b5bd6';
  const logo = shop?.logo_url && /^https:\/\//.test(shop.logo_url) ? shop.logo_url : '';
  const inner = size - pad * 2;
  const res = new ImageResponse(
    logo ? (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={inner} height={inner} style={{ objectFit: 'contain' }} />
      </div>
    ) : (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color }}>
        <svg width={inner * 0.62} height={inner * 0.62} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8h14l-1 12H6L5 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
  res.headers.set('Cache-Control', 'public, max-age=3600');
  return res;
}
