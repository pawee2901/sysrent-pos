import { NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { authorized } from '@/lib/internal';
import { sweepRenewals } from '@/lib/renewals';

export const dynamic = 'force-dynamic';

/** เตือนต่อเมลทาง LINE / แจ้งร้านเมื่อเลยกำหนด — เรียกทุก 1 นาทีจาก deploy/shop-hosts-sync.sh */
export async function POST(req: Request) {
  if (!authorized(req)) return fail('forbidden', 403);
  return NextResponse.json({ ok: true, ...(await sweepRenewals()) });
}
