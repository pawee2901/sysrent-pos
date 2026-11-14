import { db } from '@/lib/db';
import { adminShop, when } from '@/lib/admin-page';
import { PlanLock } from '@/components/PlanLock';
import { slipServiceConfigured } from '@/lib/slip-service';
import { addDays, daysLeft, feeOf, isRenewProduct, renewAllowed, renewSettings, type RenewalRow } from '@/lib/renewals';
import { RenewalsClient, type Contact, type Fam, type OptionGroup, type PendingPay, type RenewalView } from './RenewalsClient';

export const dynamic = 'force-dynamic';

/** ต่อเมล: เชื่อม LINE OA ร้าน · กรอกลูกค้า → ระบบเตือนทาง LINE → ลูกค้าจ่ายในแชท → ต่อให้อัตโนมัติ */
export default async function AdminRenewals() {
  const shop = await adminShop('renewals');
  if (!shop) return null;
  if (!renewAllowed(shop.plan)) return <PlanLock feature="renewals" />;
  const d = db();
  const root = process.env.SHOP_ROOT_DOMAIN || 'sysrent.shop';
  const webhook = `https://${shop.slug}.${root}/api/line/webhook`;

  const [{ data: line, error: lineErr }, { data: rows }, { data: prods }, { data: contacts }, { data: pays }, st] = await Promise.all([
    d.from('shop_line').select('bot_name, basic_id').eq('shop_id', shop.id).maybeSingle(),
    d.from('shop_renewals').select('*').eq('shop_id', shop.id).order('status').order('expires_on').limit(2000),
    d.from('shop_products').select('name, sort, active, shop_options(id, name, price, duration_days, active, sort)').eq('shop_id', shop.id).order('sort'),
    d.from('shop_line_contacts').select('line_user_id, display_name, last_seen').eq('shop_id', shop.id).order('last_seen', { ascending: false }).limit(1000),
    d.from('shop_renewal_pays').select('id, renewal_id, label, amount, attempts, last_error, created_at, status').eq('shop_id', shop.id).eq('status', 'pending')
      .gt('attempts', 0).gte('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString()).order('created_at', { ascending: false }),
    renewSettings(shop.id),
  ]);
  if (lineErr && (lineErr.code === '42P01' || lineErr.code === 'PGRST205')) {
    return <div className="card card-pad"><h2 style={{ marginTop: 0 }}>ต่อเมล</h2><p className="muted">ยังไม่ได้รัน <code>supabase/migrations/0028_shop_renewals.sql</code> ใน Supabase — รันแล้วรีเฟรชหน้านี้</p></div>;
  }

  type P = { name: string; active: boolean; shop_options: { id: string; name: string; price: number; duration_days: number | null; active: boolean; sort: number }[] };
  const groups: OptionGroup[] = ((prods ?? []) as P[]).filter((p) => p.active).map((p) => ({
    product: p.name, renew: isRenewProduct(p.name),
    options: p.shop_options.filter((o) => o.active).sort((a, b) => a.sort - b.sort)
      .map((o) => ({ id: o.id, label: `${o.name} · ฿${Number(o.price).toLocaleString('th-TH')}${o.duration_days ? ` · ${o.duration_days} วัน` : ''}` })),
  })).filter((g) => g.options.length).sort((a, b) => Number(b.renew) - Number(a.renew));
  const optName = new Map(groups.flatMap((g) => g.options.map((o) => [o.id, `${g.product} · ${o.label}`] as const)));

  const names = new Map((contacts ?? []).map((c) => [c.line_user_id as string, (c.display_name as string) || 'ลูกค้า LINE']));
  const list = (rows ?? []) as RenewalRow[];
  const view: RenewalView[] = list.map((r) => ({
    id: r.id, customerEmail: r.customer_email, famEmail: r.fam_email, optionId: r.option_id ?? '', option: (r.option_id && optName.get(r.option_id)) || '(แพ็กเกจถูกปิด/ลบ)',
    lineUserId: r.line_user_id, lineName: r.line_user_id ? names.get(r.line_user_id) ?? 'ลูกค้า LINE' : null, code: r.link_code,
    expiresOn: r.expires_on, left: daysLeft(r.expires_on), deadline: addDays(r.expires_on, st.graceDays), fee: feeOf(r, st).fee,
    note: r.note, active: r.status === 'active', removed: Boolean(r.removed_at), reminded: r.reminded_for === r.expires_on, renewed: r.renewed_count,
  }));
  const byId = new Map(view.map((r) => [r.id, r]));
  const pending: PendingPay[] = (pays ?? []).map((p) => ({
    id: p.id, label: p.label, amount: Number(p.amount), error: p.last_error ?? '', at: when(p.created_at),
    email: byId.get(p.renewal_id)?.customerEmail ?? '', line: byId.get(p.renewal_id)?.lineName ?? '',
  }));

  // เมลร้าน (fam): นับเฉพาะคนที่ยังต่ออยู่และยังไม่โดนลบเมล
  const famMap = new Map<string, Fam>();
  for (const r of view) {
    if (!r.active || !r.famEmail) continue;
    const f = famMap.get(r.famEmail) ?? { email: r.famEmail, used: 0, members: [] };
    if (!r.removed) { f.used++; f.members.push(r.customerEmail); }
    famMap.set(r.famEmail, f);
  }
  const contactList: Contact[] = (contacts ?? []).map((c) => ({ id: c.line_user_id as string, name: (c.display_name as string) || 'ลูกค้า LINE' }));

  return (
    <RenewalsClient
      rows={view} groups={groups} contacts={contactList} pending={pending} settings={st}
      fams={[...famMap.values()].sort((a, b) => a.email.localeCompare(b.email))}
      line={line ? { botName: line.bot_name, basicId: line.basic_id } : null} webhook={webhook}
      autoSlip={slipServiceConfigured()} hasPromptpay={Boolean(shop.promptpay_id)}
    />
  );
}
