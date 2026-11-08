import 'server-only';
import sharp from 'sharp';
import jsQR from 'jsqr';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

/**
 * อ่านสลิปเอง (ไม่ใช้ SlipOK)
 * 1) QR เล็กบนสลิป (ฟรี): ได้เลขอ้างอิงรายการ (transRef) ที่ไม่ซ้ำกันทั้งประเทศ → กันสลิปเดิมใช้ซ้ำ
 * 2) AI อ่านรูป (ถ้าตั้ง ANTHROPIC_API_KEY): ยอด · เวลา · ผู้รับ
 * ⚠️ ทั้งสองอย่างไม่ได้ถามธนาคาร — สลิปปลอมที่ทำเนียนอาจผ่านได้
 *    จึงใช้ร่วมกับ "แจ้งเตือนเงินเข้า" (lib/bank.ts) เป็นหลัก และให้สลิปอย่างเดียวเติมได้แค่ยอดเล็ก
 */

export type SlipQr = { raw: string; transRef: string; bank: string | null };

/** แยก TLV แบบ EMV (id 2 หลัก · ยาว 2 หลัก · ค่า) */
function tlv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= s.length) {
    const id = s.slice(i, i + 2), len = Number(s.slice(i + 2, i + 4));
    if (!Number.isInteger(len) || i + 4 + len > s.length) break;
    out[id] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

/** อ่าน QR บนสลิป → เลขอ้างอิงรายการ (null = ไม่พบ QR / ไม่ใช่ QR สลิปโอนเงิน) */
export async function readSlipQr(buf: Buffer): Promise<SlipQr | null> {
  for (const width of [1200, 800, 1800]) { // ลองหลายขนาด: QR สลิปเล็ก บางรูปอ่านได้ที่ขนาดเฉพาะ
    const { data, info } = await sharp(buf).rotate().resize({ width, withoutEnlargement: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const qr = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
    if (!qr?.data) continue;
    const raw = qr.data.trim();
    // QR สลิปไทย: แท็ก 00 = ข้อมูลรายการ (00 รหัส API · 01 ธนาคารผู้ส่ง · 02 เลขอ้างอิง) · 51 = TH
    const top = tlv(raw);
    const inner = top['00'] ? tlv(top['00']) : {};
    const ref = inner['02'];
    if (ref && ref.length >= 8) return { raw, transRef: ref, bank: inner['01'] ?? null };
    if (raw.length >= 20 && /^[0-9A-Za-z]+$/.test(raw)) return { raw, transRef: raw, bank: null }; // รูปแบบอื่น: ใช้ทั้งก้อนเป็นตัวกันซ้ำ
    return null; // QR อื่น เช่น QR รับเงิน / ลิงก์
  }
  return null;
}

const SlipSchema = z.object({
  is_transfer_slip: z.boolean(),
  amount: z.number().nullable(),
  paid_at: z.string().nullable(),           // ISO 8601 เวลาไทย เช่น 2026-11-07T14:05:00+07:00
  receiver_name: z.string().nullable(),
  receiver_account: z.string().nullable(),  // ตามที่เห็นบนสลิป (มี x ปิดบางหลักได้)
  sender_name: z.string().nullable(),
  bank: z.string().nullable(),
  trans_ref: z.string().nullable(),
});
export type SlipAi = z.infer<typeof SlipSchema>;

export const slipAiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** ให้ AI อ่านข้อมูลบนสลิป (คืน null = ไม่ได้ตั้งค่า / อ่านไม่สำเร็จ) */
export async function readSlipAi(buf: Buffer): Promise<SlipAi | null> {
  if (!slipAiConfigured()) return null;
  // ย่อรูปก่อนส่ง (ประหยัดค่า AI) · แปลงเป็น jpeg เสมอ
  const img = await sharp(buf).rotate().resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const client = new Anthropic();
  try {
    const res = await client.messages.parse({
      model: process.env.SLIP_AI_MODEL || 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low', format: zodOutputFormat(SlipSchema) },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.toString('base64') } },
          { type: 'text', text: [
            'Read this Thai bank transfer slip and fill the fields exactly as printed.',
            'is_transfer_slip: false if this is not a completed bank/PromptPay transfer slip.',
            'amount: the transferred amount in THB with satang (e.g. 100.37), not fees or balances.',
            'paid_at: transfer date-time as ISO 8601 with +07:00. Thai slips use Buddhist Era years (subtract 543) and Thai month abbreviations.',
            'receiver_name / receiver_account: the recipient (ผู้รับ / ไปยัง), keep masking characters like x as printed.',
            'trans_ref: the transaction reference number (เลขที่รายการ / รหัสอ้างอิง).',
            'Use null for anything not visible. Do not guess.',
          ].join('\n') },
        ],
      }],
    });
    if (res.stop_reason === 'refusal') return null;
    return res.parsed_output ?? null;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.error('[slip-ai] rate limited');
    else if (e instanceof Anthropic.APIError) console.error('[slip-ai]', e.status, e.message);
    else console.error('[slip-ai]', e);
    return null;
  }
}
