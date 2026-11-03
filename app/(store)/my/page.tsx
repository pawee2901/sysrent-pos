import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getShop } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { db } from '@/lib/db';
import { SubCard } from './SubCard';
import { LogoutButton } from './LogoutButton';

export const dynamic = 'force-dynamic';

/** แอปที่เช่าอยู่: วันคงเหลือ · ดูรหัส */
export default async function My() {
  const me = await getCustomer();
  if (!me) redirect('/login?next=/my');
  const shop = (await getShop())!;
  const d = db();
  await d.rpc('shop_expire_subs');
  const { data } = await d.from('shop_subscriptions').select('id, status, starts_at, ends_at, shop_products(id, name, image, template)')
    .eq('shop_id', shop.id).eq('customer_id', me.id).order('status').order('ends_at', { ascending: false }).limit(50);
  type R = { id: string; status: string; starts_at: string; ends_at: string; shop_products: { id: string; name: string; image: string; template: string } | null };
  const rows = ((data ?? []) as unknown as R[]).filter((r) => r.status === 'active' || Date.now() - new Date(r.ends_at).getTime() < 30 * 86_400_000);
  return (
    <>
      <div className="sec-head"><h1 style={{ fontSize: 26 }}>บัญชีของฉัน</h1><span className="muted" style={{ fontSize: 14 }}>@{me.username}</span></div>
      {!rows.length && <div className="card success"><div className="success-ic" style={{ background: 'var(--surface-2)' }}>🔑</div><p className="muted">ยังไม่มีแอปที่เช่าอยู่</p><Link href="/" className="btn primary">ไปเลือกสินค้า</Link></div>}
      <div className="subs">
        {rows.map((r) => <SubCard key={r.id} s={{ id: r.id, active: r.status === 'active', startsAt: r.starts_at, endsAt: r.ends_at, productId: r.shop_products?.id ?? '', name: r.shop_products?.name ?? 'แอป', image: r.shop_products?.image ?? '', template: r.shop_products?.template ?? '' }} />)}
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 20 }}>ใช้เฉพาะโปรไฟล์ของคุณ ห้ามเปลี่ยนรหัสผ่าน / PIN · มีปัญหาทัก LINE ร้านได้ตลอด</p>
      <div style={{ textAlign: 'center', marginTop: 12 }}><LogoutButton /></div>
    </>
  );
}
