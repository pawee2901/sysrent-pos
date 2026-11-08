/**
 * ดึงรหัส OTP หรือลิงก์ยืนยันออกจากเนื้อหาอีเมล
 * คืนทั้งโค้ดตัวเลข (ถ้ามี) และลิงก์ยืนยัน (ถ้ามี) — ฝั่งหน้าเว็บเลือกแสดงตามที่เจอ
 */
export type Extracted = { code: string | null; link: string | null };

// ลิงก์ยืนยัน/อนุมัติของบริการสตรีมมิง (เช่น ปุ่ม "ใช่ นี่คือฉัน" ของ Netflix)
const LINK_HINTS = /(verify|confirm|approve|update-primary-location|account\/travel|household|รหัส|ยืนยัน|household|temporary-access|watch-now)/i;

// คำที่มักอยู่หน้ารหัส (ไทย / อังกฤษ / จีน เช่น MangoTV "校验码为：797253")
const CODE_WORDS = 'code|otp|รหัส|โค้ด|verification|passcode|pin|验证码|校验码|驗證碼|驗證碼|动态码';

export function extractOtp(subject: string, text: string, html: string, opts: { digits?: number[] } = {}): Extracted {
  const body = `${subject}\n${stripHtml(html)}\n${text}`;

  // 1) ลิงก์ยืนยัน: หา URL ที่ดูเป็นลิงก์ยืนยันตัวตน (รวม href ใน HTML ที่ถูกตัดแท็กออกไปด้วย)
  let link: string | null = null;
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  const urls = [...hrefs, ...(body.match(/https?:\/\/[^\s"'<>)]+/gi) ?? [])];
  for (const u of urls) {
    if (/^https?:\/\//i.test(u) && LINK_HINTS.test(u)) { link = u; break; }
  }

  // 2) โค้ดตัวเลข 4–8 หลัก ที่อยู่ใกล้คำว่า code/otp/รหัส/verification
  let code: string | null = null;
  // ตั้งค่าให้หาความยาวที่กำหนดก่อน (เช่น Netflix ปุ่ม "4" = หารหัส 4 หลักก่อน กันดึงเลขผิดชุด)
  for (const n of opts.digits ?? []) {
    const re = new RegExp(`(?:${CODE_WORDS})[^0-9]{0,40}(?<!\\d)(\\d{${n}})(?!\\d)`, 'i');
    const hit = body.match(re);
    if (hit) return { code: hit[1], link };
  }
  const near = body.match(new RegExp(`(?:${CODE_WORDS})[^0-9]{0,40}(\\d{4,8})`, 'i'));
  if (near) code = near[1];
  if (!code) {
    // รหัสที่พิมพ์เว้นวรรค/ขีดคั่น เช่น "1 2 3 4 5 6" หรือ "123-456" (เฉพาะที่อยู่ใกล้คำว่า code/otp/รหัส)
    const spaced = body.match(new RegExp(`(?:${CODE_WORDS})[^0-9]{0,40}(\\d(?:[ \\-]?\\d){3,7})`, 'i'));
    if (spaced) { const d = spaced[1].replace(/\D/g, ''); if (d.length >= 4 && d.length <= 8) code = d; }
  }
  if (!code) {
    // สำรอง: โค้ดตัวเลข 6 หลักเดี่ยว ๆ ที่ไม่ติดกับตัวเลขอื่น
    const m = body.match(/(?<!\d)(\d{6})(?!\d)/);
    if (m) code = m[1];
  }

  return { code, link };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
}
