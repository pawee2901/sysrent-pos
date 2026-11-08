import type { Metadata } from 'next';
import { getShop } from '@/lib/shop';
import { adminKind, adminPerms, isShopAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { AdminLogin } from './AdminLogin';
import { AdminNav } from './AdminNav';
import './admin.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'หลังบ้านร้าน', robots: { index: false, follow: false } };

const month = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/** หลังบ้านร้าน: ยังไม่ล็อกอิน = ฟอร์มล็อกอิน · ล็อกอินแล้ว = แถบซ้าย (จอใหญ่) / เมนูล่าง (มือถือ) */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const shop = (await getShop())!;
  if (!(await isShopAdmin())) return <AdminLogin shopName={shop.name} />;
  const d = db();
  const [{ count: queue }, { count: reset }, { data: usage }] = await Promise.all([
    d.from('shop_order_items').select('id, shop_orders!inner(shop_id)', { count: 'exact', head: true }).eq('status', 'queued').eq('shop_orders.shop_id', shop.id),
    d.from('shop_slots').select('id, shop_accounts!inner(shop_id)', { count: 'exact', head: true }).eq('status', 'reset').eq('shop_accounts.shop_id', shop.id),
    d.from('shop_slip_usage').select('used').eq('shop_id', shop.id).eq('month', month()).maybeSingle(),
  ]);
  return (
    <AdminNav shop={{ name: shop.name, slug: shop.slug, logo: shop.logo_url }} counts={{ orders: queue ?? 0, accounts: reset ?? 0 }}
      slip={{ used: usage?.used ?? 0, quota: shop.slip_quota, overage: shop.slip_overage }} plan={shop.plan} perms={await adminPerms()} staff={(await adminKind()) === 'staff'}>
      {children}
    </AdminNav>
  );
}
