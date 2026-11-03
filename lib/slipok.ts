import 'server-only';

/**
 * ตรวจสลิปผ่าน SlipOK (https://slipok.com/api-documentation/check-slip/)
 * POST https://api.slipok.com/api/line/apikey/<BRANCH_ID>
 * header x-authorization: <API_KEY>
 * ส่งรูปสลิปเป็น files + amount (ให้ SlipOK เทียบยอด)
 * log=false: SlipOK ไม่เช็คบัญชีผู้รับ (สาขาผูกกับบัญชี SysRent) — ระบบตรวจผู้รับกับพร้อมเพย์/ชื่อบัญชีของร้านเอง
 * และกันสลิปซ้ำด้วย trans_ref ต่อร้าน (shop_credit_topup)
 */

export type SlipParty = {
  displayName?: string;
  name?: string;
  account?: { type?: string; value?: string };
  proxy?: { type?: string; value?: string };
};

export type SlipData = {
  transRef: string;
  transTimestamp: string;
  sendingBank?: string;
  receivingBank?: string;
  amount: number;
  ref1?: string;
  sender?: SlipParty;
  receiver?: SlipParty;
};

export type SlipResult =
  | { ok: true; data: SlipData; reused?: boolean }
  | { ok: false; code: number | null; message: string; retryable: boolean; delayMinutes?: number };

/** ข้อความภาษาไทยสำหรับลูกค้า ตามรหัสข้อผิดพลาดของ SlipOK */
const MESSAGES: Record<number, string> = {
  1000: 'ไม่พบข้อมูลสลิป กรุณาอัปโหลดรูปสลิปใหม่',
  1001: 'ระบบตรวจสลิปขัดข้อง ทีมงานได้รับแจ้งแล้ว — กรุณาเก็บสลิปไว้ แล้วติดต่อเราเพื่อดำเนินการให้',
  1002: 'ระบบตรวจสลิปขัดข้อง ทีมงานได้รับแจ้งแล้ว — กรุณาเก็บสลิปไว้ แล้วติดต่อเราเพื่อดำเนินการให้',
  1003: 'ระบบตรวจสลิปขัดข้อง ทีมงานได้รับแจ้งแล้ว — กรุณาเก็บสลิปไว้ แล้วติดต่อเราเพื่อดำเนินการให้',
  1004: 'ระบบตรวจสลิปขัดข้อง ทีมงานได้รับแจ้งแล้ว — กรุณาเก็บสลิปไว้ แล้วติดต่อเราเพื่อดำเนินการให้',
  1005: 'รองรับเฉพาะไฟล์รูป jpg, png, webp',
  1006: 'รูปสลิปไม่ถูกต้อง กรุณาอัปโหลดใหม่',
  1007: 'ไม่พบ QR code ในรูป กรุณาใช้รูปสลิปเต็มใบที่เห็น QR ชัดเจน',
  1008: 'QR ในรูปไม่ใช่สลิปโอนเงิน',
  1009: 'ระบบธนาคารขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง',
  1010: 'ธนาคารต้นทางยังไม่ส่งข้อมูลสลิป กรุณารอสักครู่แล้วอัปโหลดอีกครั้ง',
  1011: 'ไม่พบรายการโอนนี้ในระบบธนาคาร',
  1012: 'สลิปนี้ถูกใช้งานไปแล้ว',
  1013: 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องเติม',
  1014: 'บัญชีผู้รับในสลิปไม่ใช่บัญชีของร้าน',
};
const RETRYABLE = new Set([1009, 1010]);
/** ปัญหาฝั่งร้าน (ตั้งค่าผิด / แพ็กเกจหมดอายุ / โควตาหมด) — ลูกค้าแก้เองไม่ได้ ต้องแจ้งแอดมินทันที */
const OWNER_SIDE: Record<number, string> = { 1001: 'Branch ID ไม่ถูกต้อง', 1002: 'API Key ไม่ถูกต้อง', 1003: 'แพ็กเกจ SlipOK หมดอายุ', 1004: 'โควตาตรวจสลิปหมด' };

export function slipOkConfigured() {
  return Boolean(process.env.SLIPOK_BRANCH_ID && process.env.SLIPOK_API_KEY);
}

export async function checkSlip(file: Blob, filename: string, amount: number): Promise<SlipResult> {
  const branch = process.env.SLIPOK_BRANCH_ID;
  const key = process.env.SLIPOK_API_KEY;
  if (!branch || !key) return { ok: false, code: null, message: 'ยังไม่ได้ตั้งค่าระบบตรวจสลิป', retryable: false };

  const form = new FormData();
  form.append('files', file, filename);
  form.append('amount', String(amount));
  // log=false: สาขา SlipOK ผูกกับบัญชีของ SysRent — ร้านแต่ละร้านใช้บัญชีตัวเอง ระบบจึงตรวจผู้รับเอง (lib/slip-receiver) และกันสลิปซ้ำด้วย trans_ref ต่อร้าน
  form.append('log', 'false');

  let res: Response;
  try {
    res = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(branch)}`, {
      method: 'POST',
      headers: { 'x-authorization': key },
      body: form,
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, code: null, message: 'เชื่อมต่อระบบตรวจสลิปไม่ได้ กรุณาลองใหม่อีกครั้ง', retryable: true };
  }

  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; code?: number; message?: string; data?: SlipData & { success?: boolean; bankName?: string; delay?: number } }
    | null;

  if (res.ok && json?.success && json.data?.transRef) {
    return { ok: true, data: json.data };
  }

  const code = typeof json?.code === 'number' ? json.code : null;
  // 1012 = SlipOK เคยตรวจสลิปนี้แล้ว (log=true จดว่าใช้แล้วตั้งแต่ตอนตรวจ) — ถ้ารอบก่อนเราเติมเงินไม่สำเร็จ (DB ล้ม / เน็ตหลุด)
  // ลูกค้าจะติด 1012 ตลอดไป → ส่งข้อมูลสลิปกลับไปให้ route ตัดสินเอง: credit_topup กันซ้ำด้วย trans_ref ของเราอยู่แล้ว
  if (code === 1012 && json?.data?.transRef) return { ok: true, data: json.data, reused: true };
  console.error('[slipok] failed', res.status, json?.code, json?.message, code === 1010 ? JSON.stringify(json?.data) : '');
  if (code !== null && OWNER_SIDE[code]) console.error('[slipok] ปัญหาฝั่งระบบ:', OWNER_SIDE[code]);
  let message = (code !== null && MESSAGES[code]) || 'ตรวจสอบสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  // 1010: สลิปธนาคารกรุงเทพ / ไทยพาณิชย์ ต้องรอ delay นาทีหลังโอน แล้วส่งสลิปเดิมมาตรวจใหม่
  const delayMinutes = code === 1010 ? Math.max(1, Math.min(30, Number(json?.data?.delay) || 8)) : undefined;
  if (code === 1010) {
    message = `สลิปจาก${json?.data?.bankName ?? 'ธนาคารนี้'} ต้องรอประมาณ ${delayMinutes} นาทีหลังโอนจึงตรวจได้ ระบบจะตรวจให้อัตโนมัติเมื่อครบเวลา (เปิดหน้านี้ค้างไว้)`;
  }
  return {
    ok: false,
    code,
    message,
    delayMinutes,
    retryable: code === null || RETRYABLE.has(code),
  };
}
