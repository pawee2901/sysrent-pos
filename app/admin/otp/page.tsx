import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { PlanLock } from '@/components/PlanLock';
import { adminShop, when } from '@/lib/admin-page';
import { redirectUri } from '@/lib/msgraph';
import { OtpSettings } from './OtpSettings';
import { otpAgent, otpCustLimit, otpLink, otpPublic } from '@/lib/otp-link';
import { PERIOD_MS, type OtpAccess } from '@/lib/otp-agent';
import { ackConfig, itemQuotas, orderFallback } from '@/lib/otp-quota';
import type { OtpAsk } from './AsksTab';

export const dynamic = 'force-dynamic';

export default async function AdminOtp({ searchParams }: { searchParams: Promise<{ ms?: string }> }) {
  const shop = await adminShop('otp');
  if (!shop) return null;
  if (!can(shop.plan, 'otp')) return <PlanLock feature="otp" />;
  const { ms = '' } = await searchParams;
  const d = db(), h = await headers();
  const [boxes, apps, logs, config, apis] = await Promise.all([
    d.from('shop_otp_mailboxes').select('id, email, provider, active, last_error').eq('shop_id', shop.id).order('created_at'),
    d.from('shop_otp_apps').select('id, name, keywords, code').eq('shop_id', shop.id).order('sort').order('created_at'),
    d.from('shop_otp_requests').select('id, account, app, found, created_at, shop_customers(username)').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(20),
    d.from('shop_otp_config').select('ms_client_id, ms_secret_enc').eq('shop_id', shop.id).maybeSingle(),
    d.from('shop_otp_apis').select('id, name, type').eq('shop_id', shop.id).order('created_at'),
  ]);
  // ระบบตัวแทน: รหัสยืนยันทั้งหมด + ใช้ไปกี่ครั้งในรอบโควตา (ยังไม่รัน 0049 = ไม่พร้อม)
  const acc = await d.from('shop_otp_access').select('id, email, label, kind, secret, use_limit, period, active').eq('shop_id', shop.id).order('email').order('created_at');
  const access = (acc.data ?? []) as OtpAccess[];
  if (access.length) {
    const since = new Date(Date.now() - PERIOD_MS.month).toISOString();
    const { data: used } = await d.from('shop_otp_requests').select('access_id, created_at').in('access_id', access.map((a) => a.id)).eq('found', true).gte('created_at', since).limit(5000);
    for (const a of access) a.used = ((used ?? []) as { access_id: string; created_at: string }[]).filter((u) => u.access_id === a.id && Date.now() - new Date(u.created_at).getTime() < PERIOD_MS[a.period]).length;
  }
  // คำขอ OTP เพิ่ม (ยังไม่รัน 0052 = ไม่พร้อม)
  const ak = await d.from('shop_otp_asks').select('id, order_item_id, account, note, status, extra, reply, created_at, shop_customers(username), shop_order_items(name, shop_orders(code))')
    .eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(200);
  type AR = { id: string; order_item_id: string; account: string; note: string; status: string; extra: number; reply: string; created_at: string; shop_customers: { username: string } | null; shop_order_items: { name: string; shop_orders: { code: string } | null } | null };
  const akRows = (ak.data ?? []) as unknown as AR[];
  const quotas = await itemQuotas([...new Set(akRows.filter((a) => a.status === 'open').map((a) => a.order_item_id))], await orderFallback(shop.id));
  const asks: OtpAsk[] = akRows.map((a) => ({ id: a.id, account: a.account, note: a.note, status: a.status, extra: a.extra, reply: a.reply, user: a.shop_customers?.username ?? '',
    item: (a.shop_order_items?.name ?? '').split(' · ')[0], code: a.shop_order_items?.shop_orders?.code ?? '', used: quotas.get(a.order_item_id)?.used ?? 0, limit: quotas.get(a.order_item_id)?.limit ?? 0, when: when(a.created_at) }));
  type Log = { id: string; account: string; app: string; found: boolean; created_at: string; shop_customers: { username: string } | null };
  return (
    <OtpSettings
      ready={!boxes.error && !apps.error && !config.error && !apis.error}
      ms={ms}
      boxes={(boxes.data ?? []).map((b) => ({ id: b.id, email: b.email, provider: b.provider, active: b.active, error: b.last_error ?? '' }))}
      apps={(apps.data ?? []) as { id: string; name: string; keywords: string; code: string }[]}
      logs={((logs.data ?? []) as unknown as Log[]).map((l) => ({ id: l.id, user: l.shop_customers?.username ?? '', account: l.account, app: l.app, found: l.found, when: when(l.created_at) }))}
      msApp={{ clientId: (config.data?.ms_client_id as string | undefined) ?? '', hasSecret: !!config.data?.ms_secret_enc, redirect: redirectUri(h.get('x-forwarded-host') ?? h.get('host') ?? '') }}
      apis={(apis.data ?? []) as { id: string; name: string; type: string }[]}
      link={await otpLink(shop.id)}
      openPage={await otpPublic(shop.id)}
      custLimit={await otpCustLimit(shop.id)}
      asks={{ ready: !ak.error, list: asks, ack: await ackConfig(shop.id) }}
      agent={{ ready: !acc.error, on: await otpAgent(shop.id), list: access }}
    />
  );
}
