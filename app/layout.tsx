import type { Metadata, Viewport } from 'next';
import { getShop } from '@/lib/shop';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getShop();
  return {
    title: s ? { default: `${s.name} — ${s.tagline}`, template: `%s · ${s.name}` } : 'ไม่พบร้าน',
    description: s?.tagline ?? '',
    ...(s?.logo_url ? { icons: { icon: s.logo_url, apple: s.logo_url } } : {}),
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** ทุกหน้าใช้สีของร้าน (data-accent) · ไม่พบร้าน = หน้าแจ้งเตือนเดียว */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shop = await getShop();
  return (
    <html lang="th" data-accent={shop?.accent ?? 'indigo'}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {shop ? children : (
          <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
            <div className="card card-pad" style={{ maxWidth: 420 }}>
              <h1 style={{ fontSize: 22 }}>ไม่พบร้านนี้</h1>
              <p className="muted">ที่อยู่เว็บไม่ถูกต้อง หรือร้านปิดให้บริการแล้ว</p>
              <a className="btn primary" href="https://sysrent.shop">ไปที่ SysRent</a>
            </div>
          </main>
        )}
      </body>
    </html>
  );
}
