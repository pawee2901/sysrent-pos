/** Cloudflare Turnstile ฝั่งเซิร์ฟเวอร์ · ใส่คีย์ครบทั้งคู่จึงเริ่มบังคับ */
const SITE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SECRET = process.env.TURNSTILE_SECRET_KEY ?? '';

export const turnstileOn = () => !!(SITE && SECRET);

/** token ใช้ได้ครั้งเดียว · ติดต่อ Cloudflare ไม่ได้ = ไม่ผ่าน */
export async function isHuman(token: string | undefined, ip: string): Promise<boolean> {
  if (!turnstileOn()) return true;
  if (!token) return false;
  try {
    const form = new URLSearchParams({ secret: SECRET, response: token });
    if (ip && ip !== 'unknown') form.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) });
    const j = await r.json() as { success?: boolean };
    return j.success === true;
  } catch { return false; }
}
