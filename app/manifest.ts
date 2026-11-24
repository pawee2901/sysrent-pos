import type { MetadataRoute } from 'next';
import { getShop } from '@/lib/shop';
import { accentHex } from '@/lib/colors';

export const dynamic = 'force-dynamic';

/** ข้อมูลแอปร้าน (ติดตั้งลงหน้าจอมือถือ / คอม) — ชื่อ สี ไอคอน ตามร้าน */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const shop = await getShop();
  const name = shop?.name ?? 'ร้านค้า';
  const color = shop ? accentHex(shop.accent) : '#5b5bd6';
  return {
    id: '/', name, short_name: name.slice(0, 12), description: shop?.tagline || `${name} · ซื้อแอปพรีเมียม ส่งอัตโนมัติ`,
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait', background_color: '#ffffff', theme_color: color, lang: 'th',
    icons: [
      { src: '/api/app-icon?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/app-icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/api/app-icon?size=512&pad=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
