import { db } from '@/lib/db';
import { adminShop, when } from '@/lib/admin-page';
import { can } from '@/lib/plan';
import { AgentsClient, type AgentRow } from './AgentsClient';

export const dynamic = 'force-dynamic';

/** ตัวแทน: รายชื่อ + ยอดซื้อราคาตัวแทนของแต่ละคน */
export default async function AdminAgents() {
  const shop = await adminShop('agents');
  if (!shop) return null;
  const d = db();
  const { data, error } = await d.from('shop_agents').select('id, code, name, active, created_at, shop_customers(username, contact, balance)')
    .eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(500);
  type R = { id: string; code: string; name: string; active: boolean; created_at: string; shop_customers: { username: string; contact: string; balance: number } | null };
  const list = (data ?? []) as unknown as R[];
  const { data: orders } = list.length
    ? await d.from('shop_orders').select('agent_id, total').in('agent_id', list.map((r) => r.id)).not('paid_at', 'is', null)
    : { data: [] as { agent_id: string; total: number }[] };
  const stat = (id: string) => (orders ?? []).filter((o) => o.agent_id === id);
  const rows: AgentRow[] = list.map((r) => ({
    id: r.id, code: r.code, name: r.name, active: r.active, since: when(r.created_at),
    user: r.shop_customers?.username ?? '', contact: r.shop_customers?.contact ?? '', balance: Number(r.shop_customers?.balance ?? 0),
    orders: stat(r.id).length, spent: stat(r.id).reduce((s, o) => s + Number(o.total), 0),
  }));
  return <AgentsClient rows={rows} enabled={can(shop.plan, 'agents')} ready={!error} />;
}
