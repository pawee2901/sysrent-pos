import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** commit ที่เซิร์ฟเวอร์รันอยู่ — GitHub Actions ใช้เช็กว่าอัปเดตสำเร็จหรือยัง (.github/workflows/deploy-notify.yml) */
export function GET() {
  return NextResponse.json({ sha: process.env.BUILD_SHA ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
}
