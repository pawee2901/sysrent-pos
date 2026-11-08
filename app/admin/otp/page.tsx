import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { PlanLock } from '@/components/PlanLock';
import { adminShop, when } from '@/lib/admin-page';
import { redirectUri } from '@/lib/msgraph';
import { OtpSettings } from './OtpSettings';

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
    />
  );
}
