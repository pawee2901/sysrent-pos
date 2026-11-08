/**
 * ลิงก์เพลงของฟังก์ชันเสริม "เพลงในเว็บ": YouTube หรือไฟล์เสียงตรง (.mp3 .m4a .ogg .wav .aac)
 * นำมาจากเว็บ OTP (sysrantotp/lib/music.ts)
 */
export type Music = { kind: 'youtube'; id: string } | { kind: 'audio'; url: string };

export function parseMusic(raw: string): Music | null {
  const s = (raw ?? '').trim();
  if (!s || s.length > 500) return null;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? '';
    const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
    if (!id && m) id = m[1];
  }
  if (id) return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? { kind: 'youtube', id } : null;
  return /\.(mp3|m4a|ogg|oga|wav|aac)$/i.test(u.pathname) ? { kind: 'audio', url: u.toString() } : null;
}

export const MUSIC_HINT = 'ลิงก์ YouTube (youtube.com / youtu.be) หรือลิงก์ไฟล์เสียงที่ลงท้าย .mp3 .m4a .ogg .wav (ต้องขึ้นต้น https://)';
