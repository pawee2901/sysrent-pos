import { loginUrl } from '@/lib/routes';
import { to } from '@/lib/routes';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { baht, getShop } from '@/lib/shop';
import { getCustomer } from '@/lib/auth';
import { db } from '@/lib/db';
import { ITEM_STATUS, ORDER_STATUS } from '@/lib/status';
import { Delivered } from '@/components/Delivered';
import { DownloadImage } from '@/components/DownloadImage';
import { SubCard } from '../../my/SubCard';
import { productMedia } from '@/lib/media';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ paid?: string }> }) {
  const [{ code }, { paid }] = await Promise.all([params, searchParams]);
  const me = await getCustomer();
  if (!me) redirect(loginUrl(`/orders/${code}`));
  if (!/^[A-F0-9]{8}$/.test(code)) notFound();
  const shop = (await getShop())!;
  const { data: o } = await db().from('shop_orders').select('code, status, total, paid_by, created_at, paid_at, shop_order_items(id, product_id, option_id, name, qty, total, status, delivered, customer_info, fulfillment, updated_at)')
    .eq('shop_id', shop.id).eq('code', code).eq('customer_id', me.id).maybeSingle();
  if (!o) notFound();
  if (o.status === 'pending') redirect(to(`/checkout/${code}`));
  const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
  type I = { fulfillment: string; updated_at: string; id: string; product_id: string; option_id: string; name: string; qty: number; total: number; status: string; delivered: string | null; customer_info: string | null };
  const items = (o.shop_order_items ?? []) as I[];
  // วิธีการใช้งานของสินค้า (ยังไม่รัน 0011 = ไม่แสดง)
  const ids = [...new Set(items.map((i) => i.product_id))];
  const media = (await productMedia({ ids })).map;
  const usage: Record<string, string> = Object.fromEntries([...media].map(([id, m]) => [id, m.usage]));
  const usageImg: Record<string, string[]> = Object.fromEntries([...media].map(([id, m]) => [id, m.usageImages]));
  // หมดประกัน = วันจ่าย + จำนวนวันของแพ็กเกจ
  const { data: opts } = await db().from('shop_options').select('id, duration_days').in('id', [...new Set(items.map((i) => i.option_id))]);
  // สินค้าแบบแบ่งจอ: การเช่าที่ผูกกับรายการในออเดอร์นี้ (กดดูอีเมล / รหัส / PIN ได้ตรงนี้)
  const { data: subRows } = await db().from('shop_subscriptions').select('id, status, starts_at, ends_at, order_item_id, shop_products(id, name, image, template)')
    .eq('shop_id', shop.id).eq('customer_id', me.id).in('order_item_id', items.map((i) => i.id));
  type SR = { id: string; status: string; starts_at: string; ends_at: string; order_item_id: string; shop_products: { id: string; name: string; image: string; template: string } | null };
  const subOf = (itemId: string) => ((subRows ?? []) as unknown as SR[]).find((r) => r.order_item_id === itemId);
  const warranty = (i: I) => {
    const days = opts?.find((x) => x.id === i.option_id)?.duration_days;
    const start = i.fulfillment === 'manual' ? i.updated_at : o.paid_at; // สั่งทำ: นับจากวันที่ร้านส่งของ
    if (!days || !start) return null;
    return new Date(new Date(start).getTime() + days * 86_400_000).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
  };
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'grid', gap: 14 }}>
      {paid && <div className="card success" style={{ padding: 22 }}><div className="success-ic">✓</div><h2 style={{ fontSize: 20 }}>ชำระเงินสำเร็จ!</h2><p className="muted" style={{ margin: 0 }}>{o.status === 'completed' ? 'สินค้าของคุณอยู่ด้านล่าง' : 'ร้านกำลังดำเนินการ จะแจ้งผลในหน้านี้'}</p></div>}
      <div className="sec-head"><h1 style={{ fontSize: 24 }}>ออเดอร์ #{o.code}</h1><span className={`pill ${st.tone}`}>{st.label}</span></div>
      <div className="card">
        {items.map((i) => {
          const is = ITEM_STATUS[i.status] ?? ITEM_STATUS.pending;
          return (
            <div key={i.id} className="line-item" style={{ flexWrap: 'wrap' }}>
              <div className="grow"><b>{i.name}</b><small>จำนวน {i.qty} · {baht(Number(i.total))}{i.customer_info ? ` · ${i.customer_info}` : ''}</small></div>
              <span className={`pill ${is.tone}`}>{is.label}</span>
              {(() => {
                const sub = subOf(i.id);
                if (sub) return <SubCard s={{ id: sub.id, active: sub.status === 'active', startsAt: sub.starts_at, endsAt: sub.ends_at, productId: sub.shop_products?.id ?? '', name: sub.shop_products?.name ?? i.name, image: sub.shop_products?.image ?? '', template: sub.shop_products?.template ?? '' }} />;
                return i.status === 'delivered' && i.delivered ? <Delivered content={i.delivered} warranty={warranty(i)} /> : null;
              })()}
              {i.status === 'delivered' && (usage[i.product_id] || usageImg[i.product_id]?.length) && (
                <details className="usage-box" open><summary>📖 วิธีการใช้งาน</summary>
                  {usage[i.product_id] && <p>{usage[i.product_id]}</p>}
                  {(usageImg[i.product_id] ?? []).map((src, k, all) => {
                    const label = `วิธีใช้งาน ${i.name}${all.length > 1 ? ` (${k + 1})` : ''}`;
                    return <div key={`${src}${k}`} className="dlv-img"><img src={src} alt={label} loading="lazy" /><DownloadImage src={src} name={label} /></div>;
                  })}
                </details>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>ชำระด้วย{o.paid_by === 'wallet' ? 'กระเป๋าเงิน' : 'พร้อมเพย์'} · มีปัญหาทักร้านพร้อมแจ้งเลข #{o.code}</p>
      <div style={{ textAlign: 'center' }}><Link href={to('/orders')} className="btn">‹ กลับไปประวัติการซื้อ</Link></div>
    </div>
  );
}
