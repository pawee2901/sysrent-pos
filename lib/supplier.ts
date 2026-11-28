import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { db } from '@/lib/db';
import { decrypt, encConfigured, encrypt } from '@/lib/secret';

/**
 * เชื่อม API ร้านส่ง (กรอกเองได้ทุกเจ้า)
 * ร้านกรอก: URL สั่งซื้อ · POST/GET · JSON/ฟอร์ม · หัวข้อ (headers) · แม่แบบข้อมูลที่ส่ง · คีย์ API
 *          + ตำแหน่งในผลตอบกลับ: สถานะสำเร็จ / บัญชีที่ได้ / ข้อความผิดพลาด
 * ตัวแปรในแม่แบบ: {{key}} {{code}} {{qty}} {{order}} {{info}} {{user}}
 * ลูกค้าจ่ายแล้ว → fulfillViaApi ซื้อจากร้านส่งแล้วส่งของให้ลูกค้าอัตโนมัติ (จองรายการก่อนเรียก = ไม่ซื้อซ้ำ)
 */
export type Supplier = {
  id: string; name: string; buy_url: string; method: 'POST' | 'GET'; body_type: 'json' | 'form'; headers: string; body_tpl: string;
  api_key: string; ok_path: string; ok_value: string; account_path: string; error_path: string; balance_url: string; balance_path: string; active: boolean;
};
export const SUPPLIER_COLS = 'id, name, buy_url, method, body_type, headers, body_tpl, api_key, ok_path, ok_value, account_path, error_path, balance_url, balance_path, active';
export type Vars = { key: string; code: string; qty: number; order: string; info: string; user: string };

export const encKey = (k: string) => (k && encConfigured() ? encrypt(k) : k);
export function plainKey(k: string) {
  if (!k.startsWith('v1.')) return k;
  try { return decrypt(k); } catch { return ''; }
}

/* ---------- กันยิงเข้าเครือข่ายภายใน (ร้านกรอก URL เองได้) */
function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80')) return true;
    const m = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateIp(m[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
async function safeUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('URL ไม่ถูกต้อง'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('URL ต้องขึ้นต้นด้วย https:// หรือ http://');
  if (u.username || u.password) throw new Error('URL ห้ามมีชื่อผู้ใช้ / รหัสผ่าน');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('ใช้ที่อยู่ภายในไม่ได้');
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => { throw new Error('หาที่อยู่เว็บร้านส่งไม่เจอ'); })).map((x) => x.address);
  if (!ips.length || ips.some(privateIp)) throw new Error('ใช้ที่อยู่ภายในไม่ได้');
  return u;
}

/* ---------- แม่แบบ + อ่านผล */
const enc = { json: (s: string) => JSON.stringify(s).slice(1, -1), form: encodeURIComponent, url: encodeURIComponent, raw: (s: string) => s };
export function fill(tpl: string, v: Vars, how: keyof typeof enc) {
  return tpl.replace(/\{\{\s*(key|code|qty|order|info|user)\s*\}\}/g, (_, k: keyof Vars) => enc[how](String(v[k] ?? '')));
}
/** อ่านค่าตามตำแหน่ง เช่น data.account · result[0].email · ว่าง = ทั้งก้อน */
export function pick(obj: unknown, path: string): unknown {
  if (!path.trim()) return obj;
  let cur: unknown = obj;
  for (const part of path.trim().replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
/** ค่าที่อ่านได้ → ข้อความส่งลูกค้า (อ็อบเจกต์ = บรรทัดละ "ชื่อ: ค่า") */
export function asText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join('\n');
  return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x ?? '')}`).join('\n');
}

export type CallResult = { ok: boolean; http: number | null; account: string; message: string; raw: string; ms: number };

/** เรียก API ร้านส่ง 1 ครั้ง (ซื้อ / ทดสอบ) */
export async function callSupplier(s: Supplier, v: Vars, opts: { url?: string; method?: 'GET' | 'POST'; noBody?: boolean } = {}): Promise<CallResult> {
  const t0 = Date.now();
  const res = (x: Partial<CallResult>): CallResult => ({ ok: false, http: null, account: '', message: '', raw: '', ms: Date.now() - t0, ...x });
  let url: URL;
  const method = opts.method ?? s.method;
  try { url = await safeUrl(fill(opts.url ?? s.buy_url, v, 'url')); } catch (e) { return res({ message: (e as Error).message }); }
  const headers: Record<string, string> = { Accept: 'application/json, text/plain, */*', 'User-Agent': 'SysRentShop/1.0' };
  for (const line of s.headers.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) { const k = line.slice(0, i).trim(); if (/^[\w-]{1,60}$/.test(k)) headers[k] = fill(line.slice(i + 1).trim(), v, 'raw'); }
  }
  let body: string | undefined;
  if (method === 'POST' && !opts.noBody) {
    if (s.body_type === 'json') {
      body = fill(s.body_tpl || '{}', v, 'json');
      try { JSON.parse(body); } catch { return res({ message: 'แม่แบบข้อมูล (JSON) ไม่ถูกต้อง' }); }
      headers['Content-Type'] = 'application/json';
    } else {
      body = fill(s.body_tpl, v, 'form');
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }
  let r: Response;
  try {
    r = await fetch(url, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(25_000), cache: 'no-store' });
  } catch (e) {
    return res({ message: (e as Error).name === 'TimeoutError' ? 'ร้านส่งตอบช้าเกิน 25 วินาที' : 'ต่อร้านส่งไม่ได้' });
  }
  const raw = (await r.text().catch(() => '')).slice(0, 20_000);
  let json: unknown = null;
  try { json = JSON.parse(raw); } catch { /* ไม่ใช่ JSON */ }
  const errMsg = asText(s.error_path ? pick(json, s.error_path) : json && pick(json, 'message')).slice(0, 200);
  if (r.status >= 300 && r.status < 400) return res({ http: r.status, raw, message: 'ร้านส่งตอบกลับเป็นการย้ายหน้า (ตรวจ URL)' });
  if (!r.ok) return res({ http: r.status, raw, message: errMsg || `ร้านส่งตอบ HTTP ${r.status}` });
  if (s.ok_path) {
    const got = asText(pick(json, s.ok_path)).toLowerCase();
    const want = s.ok_value.trim().toLowerCase();
    if (want ? got !== want : !got || got === 'false' || got === '0') return res({ http: r.status, raw, message: errMsg || `สถานะไม่สำเร็จ (${s.ok_path} = ${got || 'ว่าง'})` });
  }
  const account = (json !== null ? asText(pick(json, s.account_path)) : s.account_path ? '' : raw.trim()).slice(0, 4000);
  if (!account) return res({ http: r.status, raw, message: s.account_path ? `ไม่พบข้อมูลบัญชีที่ ${s.account_path}` : 'ร้านส่งไม่ได้ส่งข้อมูลบัญชีกลับมา' });
  return res({ ok: true, http: r.status, raw, account });
}

/** ยอดเงินคงเหลือที่ร้านส่ง (ถ้าตั้ง URL ไว้) */
export async function supplierBalance(s: Supplier): Promise<{ ok: boolean; value: string; message: string }> {
  if (!s.balance_url) return { ok: false, value: '', message: 'ยังไม่ได้ตั้ง URL เช็กยอดเงิน' };
  const v: Vars = { key: plainKey(s.api_key), code: '', qty: 0, order: '', info: '', user: '' };
  const r = await callSupplier({ ...s, ok_path: '', account_path: s.balance_path }, v, { url: s.balance_url, method: s.method, noBody: false });
  return { ok: r.ok, value: r.account, message: r.message };
}

async function log(shopId: string, supplierId: string, kind: 'buy' | 'test' | 'balance', r: CallResult, itemId?: string) {
  await db().from('shop_supplier_logs').insert({
    shop_id: shopId, supplier_id: supplierId, order_item_id: itemId ?? null, kind, ok: r.ok, http: r.http, note: r.ok ? 'สำเร็จ' : r.message, response: r.raw.slice(0, 2000), ms: r.ms,
  }).then(() => {}, () => {});
}
export { log as supplierLog };

type QItem = { id: string; qty: number; status: string; option_id: string; customer_info: string | null; api_status: string | null };

/**
 * ออเดอร์จ่ายแล้ว → รายการที่ผูก API ร้านส่ง: จอง (api_status = calling) → เรียก API → ส่งของ / บันทึกว่าไม่สำเร็จ
 * retry = แอดมินกดส่งใหม่ (รายการที่ fail เท่านั้น) · คืนจำนวนรายการที่ส่งสำเร็จ
 */
export async function fulfillViaApi(shopId: string, orderId: string, only?: { itemId: string; retry: boolean }): Promise<{ sent: number; failed: string[] }> {
  const d = db();
  const out = { sent: 0, failed: [] as string[] };
  const { data: o } = await d.from('shop_orders').select('id, code, shop_id, paid_at, shop_customers(username)').eq('id', orderId).eq('shop_id', shopId).maybeSingle();
  if (!o?.paid_at) return out;
  let q = d.from('shop_order_items').select('id, qty, status, option_id, customer_info, api_status').eq('order_id', orderId).eq('status', 'queued');
  if (only) q = q.eq('id', only.itemId);
  const { data: items, error } = await q;
  if (error || !items?.length) return out; // ยังไม่รัน 0057 = ข้าม
  const opts = await d.from('shop_options').select('id, supplier_id, api_code').in('id', [...new Set((items as QItem[]).map((i) => i.option_id))]);
  const map = new Map(((opts.data ?? []) as { id: string; supplier_id: string | null; api_code: string }[]).filter((x) => x.supplier_id).map((x) => [x.id, x]));
  if (!map.size) return out;
  const sups = await d.from('shop_suppliers').select(SUPPLIER_COLS).eq('shop_id', shopId).in('id', [...new Set([...map.values()].map((x) => x.supplier_id!))]);
  const supById = new Map(((sups.data ?? []) as Supplier[]).map((s) => [s.id, s]));
  const user = (o as unknown as { shop_customers: { username: string } | null }).shop_customers?.username ?? '';

  for (const it of items as QItem[]) {
    const m = map.get(it.option_id);
    const s = m && supById.get(m.supplier_id!);
    if (!m || !s || !s.active || !s.buy_url) continue;
    // จองก่อนเรียก: เรียกพร้อมกันหลายทาง (จ่ายเงิน / แจ้งเตือน / กดซ้ำ) ซื้อได้ครั้งเดียว
    let claim = d.from('shop_order_items').update({ api_status: 'calling', api_note: null }).eq('id', it.id).eq('status', 'queued');
    claim = only?.retry ? claim.eq('api_status', 'fail') : claim.is('api_status', null);
    const { data: got } = await claim.select('id');
    if (!got?.length) continue;
    const r = await callSupplier(s, { key: plainKey(s.api_key), code: m.api_code, qty: it.qty, order: o.code, info: it.customer_info ?? '', user });
    await log(shopId, s.id, 'buy', r, it.id);
    if (!r.ok) {
      await d.from('shop_order_items').update({ api_status: 'fail', api_note: `${s.name}: ${r.message}`.slice(0, 300) }).eq('id', it.id);
      out.failed.push(r.message);
      continue;
    }
    const { error: dErr } = await d.rpc('shop_deliver_item', { p_shop: shopId, p_item: it.id, p_content: r.account });
    await d.from('shop_order_items').update({ api_status: dErr ? 'fail' : 'ok', api_note: dErr ? `ซื้อจาก ${s.name} แล้ว แต่บันทึกส่งของไม่สำเร็จ — ข้อมูลที่ได้: ${r.account}`.slice(0, 300) : s.name }).eq('id', it.id);
    if (dErr) out.failed.push('บันทึกส่งของไม่สำเร็จ'); else out.sent++;
  }
  return out;
}

/** เรียกหลังจ่ายเงิน: ไม่ให้ error ของ API ทำให้การจ่ายเงินล้ม */
export async function fulfillSafe(shopId: string, orderId: string) {
  try { return await fulfillViaApi(shopId, orderId); } catch (e) { console.error('[supplier] fulfill', e); return { sent: 0, failed: ['ระบบขัดข้อง'] }; }
}
