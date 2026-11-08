import 'server-only';
import type { SlipResult } from '@/lib/slipok';

/**
 * ตรวจสลิปผ่าน Thunder (https://document.thunder.in.th/en/v2/verify/bank/payload)
 * POST https://api.thunder.in.th/v2/verify/bank · Authorization: Bearer <THUNDER_API_KEY>
 * ส่ง QR payload (อ่านจากสลิปเอง ข้อมูลเล็ก) ถ้ามี · ไม่มี = ส่งรูป (multipart field "image", ไม่เกิน 4MB)
 * matchAmount = ให้ Thunder เทียบยอด · กันสลิปซ้ำทำเองต่อร้าน (trans_ref ใน shop_topups) จึงไม่ใช้ checkDuplicate
 */
const URL_VERIFY = 'https://api.thunder.in.th/v2/verify/bank';

export const thunderConfigured = () => Boolean(process.env.THUNDER_API_KEY);

type Name = { th?: string; en?: string };
type Party = { bank?: { id?: string; name?: string; short?: string }; account?: { name?: Name; bank?: { type?: string; account?: string }; proxy?: { type?: string; account?: string } } };
type Ok = { success: true; data: { isDuplicate?: boolean; isAmountMatched?: boolean; amountInSlip?: number; rawSlip: { transRef: string; date: string; amount: { amount: number }; sender?: Party; receiver?: Party } } };
type Fail = { success: false; error?: { code?: string; message?: string } };

/** ข้อความภาษาไทยตามรหัสข้อผิดพลาดของ Thunder */
const MSG: Record<string, [string, boolean]> = {
  SLIP_NOT_FOUND: ['ไม่พบรายการโอนนี้ในระบบธนาคาร หรือรูปไม่มี QR — ใช้สลิปจากแอปธนาคารแบบเต็มใบ', false],
  SLIP_PENDING: ['ธนาคารยังไม่ส่งข้อมูลสลิป กรุณารอ 2–3 นาทีแล้วอัปโหลดอีกครั้ง', true],
  IMAGE_SIZE_TOO_LARGE: ['ไฟล์ใหญ่เกิน 4MB', false],
  INVALID_IMAGE_FORMAT: ['รูปสลิปไม่ถูกต้อง กรุณาอัปโหลดใหม่', false],
  VALIDATION_ERROR: ['รูปสลิปไม่ถูกต้อง กรุณาอัปโหลดใหม่', false],
  API_SERVER_ERROR: ['ระบบธนาคารขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง', true],
};
/** ปัญหาฝั่งระบบ (คีย์ผิด / โควตาหมด / IP ไม่อยู่ในรายการ) — ลูกค้าแก้เองไม่ได้ */
const OWNER_SIDE = new Set(['MISSING_API_KEY', 'INVALID_API_KEY', 'BRANCH_INACTIVE', 'SERVICE_BANNED', 'SERVICE_DELETED', 'IP_NOT_ALLOWED', 'QUOTA_EXCEEDED', 'USER_BANNED', 'INTERNAL_SERVER_ERROR']);

const party = (p?: Party) => p && {
  displayName: p.account?.name?.th || p.account?.name?.en || '',
  name: p.account?.name?.en || p.account?.name?.th || '',
  account: { type: p.account?.bank?.type, value: p.account?.bank?.account },
  proxy: { type: p.account?.proxy?.type, value: p.account?.proxy?.account },
};

export async function checkSlipThunder(file: Blob, amount: number, payload: string | null): Promise<SlipResult> {
  const headers: Record<string, string> = { Authorization: `Bearer ${process.env.THUNDER_API_KEY}` };
  let body: BodyInit;
  if (payload) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ payload, matchAmount: amount });
  } else {
    const fd = new FormData();
    fd.append('image', file, 'slip.' + (file.type.split('/')[1] || 'jpg'));
    fd.append('matchAmount', String(amount));
    body = fd;
  }

  let res: Response;
  try {
    res = await fetch(URL_VERIFY, { method: 'POST', headers, body, signal: AbortSignal.timeout(25_000) });
  } catch (e) {
    console.error('[thunder] network', e);
    return { ok: false, code: null, message: 'เชื่อมต่อระบบตรวจสลิปไม่ได้ กรุณาลองใหม่', retryable: true };
  }
  const j = (await res.json().catch(() => null)) as Ok | Fail | null;
  if (!j) return { ok: false, code: res.status, message: 'ระบบตรวจสลิปขัดข้อง กรุณาลองใหม่', retryable: true };

  if (!j.success) {
    const code = j.error?.code ?? '';
    if (OWNER_SIDE.has(code)) {
      console.error('[thunder] ตั้งค่า/บัญชี Thunder มีปัญหา:', code, j.error?.message);
      return { ok: false, code: res.status, message: 'ระบบตรวจสลิปขัดข้อง ทีมงานได้รับแจ้งแล้ว — กรุณาเก็บสลิปไว้ แล้วติดต่อร้านเพื่อดำเนินการให้', retryable: false };
    }
    const [message, retryable] = MSG[code] ?? ['ตรวจสลิปไม่สำเร็จ กรุณาลองใหม่', res.status >= 500];
    return { ok: false, code: res.status, message, retryable };
  }

  const s = j.data.rawSlip;
  if (j.data.isAmountMatched === false) return { ok: false, code: 200, message: `ยอดในสลิป ฿${Number(j.data.amountInSlip ?? s.amount?.amount).toFixed(2)} ไม่ตรงกับยอดที่ต้องโอน ฿${amount.toFixed(2)}`, retryable: false };
  return {
    ok: true,
    data: {
      transRef: s.transRef,
      transTimestamp: s.date,
      amount: Number(s.amount?.amount),
      sendingBank: s.sender?.bank?.short,
      receivingBank: s.receiver?.bank?.short,
      sender: party(s.sender),
      receiver: party(s.receiver),
    },
  };
}
