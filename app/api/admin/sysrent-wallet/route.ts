import { NextResponse } from 'next/server';
import { fail, requireAdmin } from '@/lib/api';
import { walletApi } from '@/lib/sysrent-wallet';

export const dynamic = 'force-dynamic';
export const maxDuration = 40;

/**
 * เติมเงินกระเป๋า SysRent (จ่ายค่าตรวจสลิป) จากหลังบ้านร้าน — ส่งต่อให้เว็บเช่าเป็นคนสร้าง QR / ตรวจสลิป / เติมเงิน
 *   JSON { action: 'balance' } · { action: 'create', amount } · form { action: 'slip', id, slip }
 */
export async function POST(req: Request) {
  const a = await requireAdmin(['payments', 'settings']);
  if ('res' in a) return a.res;
  const isForm = (req.headers.get('content-type') ?? '').includes('multipart/form-data');
  if (isForm) {
    const fd = await req.formData().catch(() => null);
    const slip = fd?.get('slip'), id = String(fd?.get('id') ?? '');
    if (!(slip instanceof Blob) || !slip.size) return fail('กรุณาเลือกรูปสลิป');
    const out = new FormData();
    out.set('action', 'slip'); out.set('slug', a.shop.slug); out.set('id', id); out.set('slip', slip, 'slip.' + ((slip.type.split('/')[1]) || 'jpg'));
    const r = await walletApi(out);
    return NextResponse.json(r.data, { status: r.status });
  }
  const b = (await req.json().catch(() => null)) as { action?: string; amount?: number } | null;
  if (b?.action !== 'balance' && b?.action !== 'create') return fail('คำสั่งไม่ถูกต้อง');
  const r = await walletApi({ action: b.action, slug: a.shop.slug, ...(b.action === 'create' ? { amount: Number(b.amount) } : {}) });
  return NextResponse.json(r.data, { status: r.status });
}
