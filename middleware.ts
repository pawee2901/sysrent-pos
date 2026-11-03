import { NextResponse, type NextRequest } from 'next/server';

export const config = { matcher: ['/api/:path*'] };

/**
 * กัน CSRF: คำขอที่แก้ข้อมูล (POST/PATCH/DELETE) ต้องมาจากหน้าเว็บร้านเดียวกัน
 * ยกเว้น API ภายในที่ SysRent เรียก (ใช้กุญแจลับแทน)
 */
export function middleware(req: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.nextUrl.pathname.startsWith('/api/internal/')) return NextResponse.next();
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  let from = '';
  try { from = origin ? new URL(origin).host : ''; } catch { /* Origin: null */ }
  if (!from || !host || from !== host) {
    return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  }
  return NextResponse.next();
}
