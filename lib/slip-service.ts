import 'server-only';
import { checkSlip as checkSlipOk, slipOkConfigured, type SlipResult } from '@/lib/slipok';
import { checkSlipThunder, thunderConfigured } from '@/lib/thunder';
import { readSlipQr } from '@/lib/slip-read';

/**
 * บริการตรวจสลิปกับธนาคาร (เสียเงินต่อสลิป แต่จับสลิปปลอมได้จริง)
 * SLIP_PROVIDER=thunder | slipok · ไม่ตั้ง = ใช้ Thunder ถ้ามีคีย์ ไม่งั้น SlipOK
 * ไม่มีทั้งคู่ = ใช้การตรวจเอง (lib/slip-free.ts)
 */
export function slipProvider(): 'thunder' | 'slipok' | null {
  const want = process.env.SLIP_PROVIDER;
  if (want === 'thunder') return thunderConfigured() ? 'thunder' : null;
  if (want === 'slipok') return slipOkConfigured() ? 'slipok' : null;
  return thunderConfigured() ? 'thunder' : slipOkConfigured() ? 'slipok' : null;
}
export const slipServiceConfigured = () => slipProvider() !== null;

export async function verifySlip(file: Blob, amount: number): Promise<SlipResult> {
  if (slipProvider() === 'thunder') {
    // อ่าน QR เองก่อน (ฟรี) → ส่งแค่ข้อความ QR ให้ Thunder · อ่านไม่ได้ = ส่งรูปให้ Thunder อ่าน
    const qr = await readSlipQr(Buffer.from(await file.arrayBuffer())).catch(() => null);
    const payload = qr && qr.raw.length <= 128 ? qr.raw : null;
    return checkSlipThunder(file, amount, payload);
  }
  return checkSlipOk(file, 'slip.' + (file.type.split('/')[1] || 'jpg'), amount);
}
