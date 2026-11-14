import { NextResponse, type NextRequest } from 'next/server';

// path จริงของหน้าเว็บ: เข้าตรงไม่ได้ ต้องผ่านลิงก์สาธารณะใน lib/url-map.json
export const config = { matcher: ['/api/:path*', '/', '/admin/:path*', '/cart/:path*', '/checkout/:path*', '/orders/:path*', '/wallet/:path*', '/login/:path*', '/my/:path*', '/p/:path*', '/terms/:path*', '/otp/:path*'] };

/**
 * กัน CSRF: คำขอที่แก้ข้อมูล (POST/PATCH/DELETE) ต้องมาจากหน้าเว็บร้านเดียวกัน
 * ยกเว้น API ภายในที่ SysRent เรียก (ใช้กุญแจลับแทน)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname !== '/' && !pathname.startsWith('/api/')) return NextResponse.rewrite(new URL('/_hidden-route', req.url));

  // ตั้ง cookie ref จาก ?ref= parameter (สำหรับระบบตัวแทน)
  if (req.nextUrl.pathname === '/') {
    const ref = req.nextUrl.searchParams.get('ref');
    if (ref && /^[A-Z0-9]{3,20}$/i.test(ref)) {
      const res = NextResponse.next();
      res.cookies.set('ref', ref.toUpperCase(), { httpOnly: false, maxAge: 30 * 86400, path: '/' });
      return res;
    }
    return NextResponse.next();
  }

  // /api/line/ = Webhook ที่ LINE ส่งมา (ไม่มี Origin) — ตรวจลายเซ็น Channel secret ของร้านแทน
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.nextUrl.pathname.startsWith('/api/internal/') || req.nextUrl.pathname.startsWith('/api/line/')) return NextResponse.next();
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  let from = '';
  try { from = origin ? new URL(origin).host : ''; } catch { /* Origin: null */ }
  if (!from || !host || from !== host) {
    return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  }
  return NextResponse.next();
}
