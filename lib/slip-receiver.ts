import 'server-only';

/**
 * ตรวจว่าสลิปโอนเข้าบัญชีของร้านนี้จริง (SlipOK ตั้ง log=false จึงไม่ได้เช็คผู้รับให้)
 * ผ่านเมื่อ: เลขพร้อมเพย์บนสลิปตรงกับของร้าน (เทียบแบบชิดขวา ข้ามตัวที่ถูกปิด x) หรือชื่อผู้รับตรงกับชื่อบัญชีที่ร้านตั้งไว้
 */
const TITLES = /^(นาย|นางสาว|นาง|น\.\s*ส\.?|บริษัท|บจก\.?|หจก\.?|mrs\.?|mr\.?|miss|ms\.?)\s*/i;
const norm = (s: string) => s.trim().replace(TITLES, '').replace(/[\s.\-_]/g, '').toLowerCase();

function promptPayIds(id: string): string[] {
  const d = id.replace(/\D/g, '');
  if (d.length < 4) return [];
  return d.length === 10 && d.startsWith('0') ? [d, '66' + d.slice(1)] : [d];
}
function maskedEquals(masked: string, full: string): boolean {
  const m = masked.replace(/[^0-9xX]/g, '');
  let seen = 0;
  for (let i = 1; i <= Math.min(m.length, full.length); i++) {
    const c = m[m.length - i];
    if (c === 'x' || c === 'X') continue;
    if (c !== full[full.length - i]) return false;
    seen++;
  }
  return seen >= 4;
}

type Party = { displayName?: string; name?: string; account?: { value?: string }; proxy?: { value?: string } };

/** true = ผู้รับเป็นร้านนี้ · false = ไม่ใช่ / ข้อมูลไม่พอยืนยัน */
export function receiverIsShop(receiver: Party | undefined, shop: { promptpay_id: string; receiver_name: string }): boolean {
  if (!receiver) return false;
  const ids = promptPayIds(shop.promptpay_id);
  const nums = [receiver.proxy?.value ?? '', receiver.account?.value ?? ''].filter((v) => (v.match(/\d/g) ?? []).length >= 4);
  if (nums.some((n) => ids.some((id) => maskedEquals(n, id)))) return true;
  const names = shop.receiver_name.split(',').map((s) => s.trim()).filter(Boolean);
  const slipNames = [receiver.displayName ?? '', receiver.name ?? ''].map((n) => norm(n.replace(/[x*\s]+$/i, ''))).filter((n) => n.length >= 5);
  return slipNames.some((sn) => names.some((n) => { const r = norm(n); return r.startsWith(sn) || sn.startsWith(r); }));
}
