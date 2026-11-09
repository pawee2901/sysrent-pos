import { to } from '@/lib/routes';
import Link from 'next/link';
import { db } from '@/lib/db';
import { adminShop } from '@/lib/admin-page';
import { AccountsClient, type Acc } from './AccountsClient';

/** คลังบัญชี: บัญชีหลักของสินค้าแบบแบ่งจอ → จอ → ใครเช่าอยู่ถึงเมื่อไหร่ */
export default async function AdminAccounts({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const shop = await adminShop('accounts');
  if (!shop) return null;
  const d = db();
  await d.rpc('shop_expire_subs');
  const { p = '' } = await searchParams;
  const { data: prods } = await d.from('shop_products').select('id, name, image, template').eq('shop_id', shop.id).eq('fulfillment', 'slot').order('sort');
  const products = prods ?? [];
  if (!products.length) {
    return (
      <>
        <div className="page-head"><div><h1>คลังบัญชี</h1><p>บัญชีหลักที่ร้านซื้อมา แบ่งเป็นจอ · ขายแล้วระบบจัดจอให้อัตโนมัติ</p></div></div>
        <div className="card card-pad"><p style={{ margin: 0 }}>ยังไม่มีสินค้าแบบ <b>แบ่งจอ</b> — ไปที่ <Link href={to('/admin/products')}>สินค้า</Link> → ระบบแบ่งจอ แล้วเลือกแอป เช่น Netflix จากนั้นกลับมาเพิ่มบัญชีที่นี่</p></div>
      </>
    );
  }
  const cur = products.find((x) => x.id === p) ?? products[0];
  const [{ data: accs }, { data: subs }, { data: opts }] = await Promise.all([
    d.from('shop_accounts').select('id, login, cost, renew_at, status, shop_slots(id, label, pin, sort, status)').eq('product_id', cur.id).eq('shop_id', shop.id).order('created_at'),
    d.from('shop_subscriptions').select('slot_id, ends_at, shop_customers(username)').eq('product_id', cur.id).eq('status', 'active'),
    d.from('shop_options').select('name, duration_days').eq('product_id', cur.id).eq('active', true).order('sort'),
  ]);
  type S = { slot_id: string; ends_at: string; shop_customers: { username: string } | null };
  const rent = new Map(((subs ?? []) as unknown as S[]).map((s) => [s.slot_id, { user: s.shop_customers?.username ?? '-', days: Math.ceil((new Date(s.ends_at).getTime() - Date.now()) / 86_400_000) }]));
  type A = { id: string; login: string; cost: number | null; renew_at: string | null; status: string; shop_slots: { id: string; label: string; pin: string; sort: number; status: string }[] };
  const accounts: Acc[] = ((accs ?? []) as A[]).map((a) => ({
    id: a.id, login: a.login, cost: a.cost === null ? null : Number(a.cost), renewAt: a.renew_at, status: a.status,
    slots: [...a.shop_slots].sort((x, y) => x.sort - y.sort).map((s) => ({ ...s, rent: rent.get(s.id) ?? null })),
  }));
  return <AccountsClient products={products.map((x) => ({ id: x.id, name: x.name }))} current={{ id: cur.id, name: cur.name, image: cur.image, template: cur.template }} accounts={accounts} plans={(opts ?? []).map((o) => ({ name: o.name as string, days: (o.duration_days as number | null) ?? 30 }))} />;
}
