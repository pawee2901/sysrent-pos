import 'server-only';

/**
 * สร้างข้อความ QR พร้อมเพย์ (มาตรฐาน EMVCo / Thai QR Payment) พร้อมจำนวนเงิน
 * รองรับ: เบอร์มือถือ 10 หลัก, เลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก, e-Wallet ID 15 หลัก
 * สแกนจ่ายได้จากแอปธนาคารทุกธนาคาร ไม่ต้องให้ลูกค้าเลือกธนาคาร
 */
export function promptPayPayload(id: string, amount: number): string {
  const target = id.replace(/\D/g, '');
  let acc: string;
  if (target.length === 10) acc = f('01', ('0066' + target.slice(1)).padStart(13, '0')); // เบอร์มือถือ
  else if (target.length === 13) acc = f('02', target);                                 // บัตรประชาชน / Tax ID
  else if (target.length === 15) acc = f('03', target);                                 // e-Wallet
  else throw new Error('เลขพร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก, เลข 13 หลัก หรือ e-Wallet 15 หลัก');

  const body =
    f('00', '01') +
    f('01', '12') +                                   // 12 = QR ใช้ครั้งเดียวแบบมีจำนวนเงิน
    f('29', f('00', 'A000000677010111') + acc) +
    f('58', 'TH') +
    f('53', '764') +                                  // THB
    f('54', amount.toFixed(2)) +
    '6304';
  return body + crc16(body);
}

function f(tag: string, value: string) {
  return tag + String(value.length).padStart(2, '0') + value;
}

/** CRC-16/CCITT-FALSE ตามที่ EMVCo กำหนด */
function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** รูป QR (PNG) สำหรับส่งเข้าแชท LINE (ต่อเมล) */
export async function promptPayQrPng(id: string, amount: number): Promise<Buffer> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toBuffer(promptPayPayload(id, amount), { type: 'png', width: 720, margin: 3, errorCorrectionLevel: 'M' });
}

/** รูป QR (SVG) ของร้าน — เลขพร้อมเพย์ของร้านนั้น (ไม่ใช่ของ SysRent) */
export async function promptPayQrSvg(id: string, amount: number): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toString(promptPayPayload(id, amount), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
}
