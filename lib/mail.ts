import 'server-only';
import nodemailer from 'nodemailer';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/secret';

/**
 * ส่งอีเมลแจ้งลูกค้า: ใช้ Gmail ของร้าน (ตั้งในหลังบ้าน) ก่อน · ไม่ได้ตั้ง = ใช้ SMTP กลางใน .env.local (ถ้ามี) · ไม่มีทั้งคู่ = ไม่ส่ง
 * ร้านใส่ได้เฉพาะ Gmail: ไม่เปิดให้กรอก host เอง กันถูกใช้สั่งเซิร์ฟเวอร์ไปต่อเครื่องอื่นในระบบ
 */
export type SmtpCreds = { user: string; pass: string };

export const mailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const gmail = (c: SmtpCreds) => nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: c.user, pass: c.pass },
  connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
});

let tx: ReturnType<typeof nodemailer.createTransport> | null = null;
function systemTransport() {
  if (tx) return tx;
  const port = Number(process.env.SMTP_PORT) || 587;
  tx = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  return tx;
}

/** ลองล็อกอิน Gmail ก่อนบันทึก → ข้อความผิดพลาด หรือ null ถ้าผ่าน */
export async function verifyGmail(c: SmtpCreds): Promise<string | null> {
  try { await gmail(c).verify(); return null; } catch (e) {
    console.warn('[mail] verify', (e as Error).message);
    return /auth|credentials|535|534/i.test((e as Error).message)
      ? 'Gmail ไม่ยอมรับ ตรวจอีเมลและ App Password อีกครั้ง (ต้องเป็น App Password 16 ตัว ไม่ใช่รหัสผ่าน Gmail ปกติ)'
      : 'เชื่อมต่อ Gmail ไม่ได้ กรุณาลองใหม่';
  }
}

/** Gmail ของร้าน (ยังไม่ตั้ง / ยังไม่รัน 0021 = null) */
export async function shopSmtp(shopId: string): Promise<SmtpCreds | null> {
  const { data, error } = await db().from('shops').select('smtp_user, smtp_pass_enc').eq('id', shopId).maybeSingle();
  if (error || !data?.smtp_user || !data.smtp_pass_enc) return null;
  try { return { user: data.smtp_user as string, pass: decrypt(data.smtp_pass_enc as string) }; } catch { return null; }
}

export async function sendMail(m: { to: string; subject: string; html: string; text: string; fromName: string; smtp?: SmtpCreds | null }): Promise<boolean> {
  if (!m.smtp && !mailConfigured()) { console.warn('[mail] ร้านยังไม่ได้ตั้ง Gmail และไม่มี SMTP กลาง — ข้ามการส่งอีเมล'); return false; }
  try {
    await (m.smtp ? gmail(m.smtp) : systemTransport()).sendMail({
      from: { name: m.fromName.replace(/[\r\n"]/g, ' ').slice(0, 60), address: m.smtp?.user ?? (process.env.SMTP_FROM || process.env.SMTP_USER!) },
      to: m.to, subject: m.subject.replace(/[\r\n]/g, ' '), html: m.html, text: m.text,
    });
    return true;
  } catch (e) {
    console.error('[mail] ส่งไม่สำเร็จ', (e as Error).message);
    return false;
  }
}
