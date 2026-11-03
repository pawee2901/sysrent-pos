import { db } from '@/lib/db';
import { adminShop, when } from '@/lib/admin-page';
import { CustomersClient } from './CustomersClient';

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const shop = await adminShop();
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
  const rows = (data ?? []).map((c) => ({ id: c.id, username: c.username, contact: c.contact, balance: Number(c.balance), blocked: c.blocked, joined: when(c.created_at), orders: sum.get(c.id)?.n ?? 0, spent: sum.get(c.id)?.total ?? 0 }));
  return <CustomersClient rows={rows} total={count ?? 0} q={q} />;
}
