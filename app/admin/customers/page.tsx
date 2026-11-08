import { db } from '@/lib/db';
import { adminShop, when } from '@/lib/admin-page';
import { CustomersClient, type Role } from './CustomersClient';
import { adminKind } from '@/lib/auth';
import { can } from '@/lib/plan';
import { cleanPerms } from '@/lib/perms';

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const shop = await adminShop('customers');
  if (!shop) return null;
  const { q = '' } = await searchParams;
  const d = db();
  let query = d.from('shop_customers').select('id, username, contact, balance, blocked, created_at').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(200);
  const t = q.trim().toLowerCase().replace(/[^a-z0-9_@.\-ก-๙ ]/g, '');
  if (t) query = query.or(`username.ilike.%${t}%,contact.ilike.%${t}%`);
  const [{ data }, { count }, { data: spent }] = await Promise.all([
    query,
    d.from('shop_customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
    d.from('shop_orders').select('customer_id, total').eq('shop_id', shop.id).not('paid_at', 'is', null).limit(20000),
  ]);
  const sum = new Map<string, { n: number; total: number }>();
  for (const o of spent ?? []) { const s = sum.get(o.customer_id) ?? { n: 0, total: 0 }; s.n++; s.total += Number(o.total); sum.set(o.customer_id, s); }
  // ยศ: แอดมิน (shop_customers.role · 0017) · ตัวแทน (shop_agents · 0016) — ยังไม่รัน SQL = ทุกคนเป็นลูกค้าทั่วไป
  const ids = (data ?? []).map((c) => c.id);
  const [roles, agents, kind] = await Promise.all([
    ids.length ? d.from('shop_customers').select('id, role, admin_perms').in('id', ids).then((r) => (r.error ? d.from('shop_customers').select('id, role').in('id', ids) : r)) : Promise.resolve({ data: [], error: null }),
    ids.length ? d.from('shop_agents').select('customer_id, active').eq('shop_id', shop.id).in('customer_id', ids) : Promise.resolve({ data: [], error: null }),
    adminKind(),
  ]);
  const roleOf = (id: string): Role => {
    if (!roles.error && (roles.data as { id: string; role: string }[] | null)?.find((r) => r.id === id)?.role === 'admin') return 'admin';
    if (!agents.error && (agents.data as { customer_id: string; active: boolean }[] | null)?.some((a) => a.customer_id === id && a.active)) return 'agent';
    return 'customer';
  };
  // ตัวแทน (รวมที่พักสิทธิ์) อยู่หน้าตัวแทน · หน้านี้แสดงเฉพาะลูกค้า
  const isAgent = (id: string) => !agents.error && (agents.data as { customer_id: string }[] | null)?.some((a) => a.customer_id === id);
  const permsOf = (id: string) => cleanPerms((roles.data as { id: string; admin_perms?: string[] }[] | null)?.find((r) => r.id === id)?.admin_perms);
  const rows = (data ?? []).filter((c) => !isAgent(c.id)).map((c) => ({ id: c.id, username: c.username, contact: c.contact, balance: Number(c.balance), blocked: c.blocked, joined: when(c.created_at), orders: sum.get(c.id)?.n ?? 0, spent: sum.get(c.id)?.total ?? 0, role: roleOf(c.id), perms: permsOf(c.id) }));
  return <CustomersClient rows={rows} total={Math.max(0, (count ?? 0) - ((data ?? []).length - rows.length))} q={q} owner={kind === 'owner'} agentsOn={can(shop.plan, 'agents')} rolesReady={!roles.error} staffOn={can(shop.plan, 'staff')} exportOn={can(shop.plan, 'export')} />;
}
