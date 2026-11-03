import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getShop, baht, shopOpen } from '@/lib/shop';
import { loadProducts } from '@/lib/catalog';
import { AppLogo } from '@/components/AppLogo';
import { BuyBox } from './BuyBox';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const shop = (await getShop())!;
  const [p] = await loadProducts(shop.id, { id });
  if (!p) notFound();
  return (
    <>
      <div className="crumb"><Link href="/">หน้าแรก</Link> › {p.category} › {p.name}</div>
      <div className="pd">
        <div className="card pd-media"><AppLogo image={p.image} template={p.template} name={p.name} size="xl" /></div>
        <div>
          {p.badge && <span className="pill accent plain">{p.badge}</span>}
          <h1>{p.name}</h1>
          <div className="pd-sub">
            <span>ขายแล้ว {p.sold.toLocaleString('th-TH')}</span>
            {p.inStock ? <span className="pill ok">{p.left === null ? 'พร้อมส่ง' : `พร้อมส่ง ${p.left}`}</span> : <span className="pill bad">หมดชั่วคราว</span>}
            {p.from !== null && <span>เริ่ม {baht(p.from)}</span>}
          </div>
          <BuyBox open={shopOpen(shop)} product={{ id: p.id, name: p.name, image: p.image, template: p.template, fulfillment: p.fulfillment }} options={p.options} />
          <div className="perks">
            <div className="card perk"><i>⚡</i><span>{p.fulfillment === 'manual' ? 'จ่ายแล้วร้านดำเนินการให้ แจ้งผลในหน้าออเดอร์' : 'จ่ายแล้วได้รหัสทันที ไม่ต้องรอแอดมิน'}</span></div>
            <div className="card perk"><i>🛡️</i><span>รับประกันตลอดอายุแพ็กเกจ</span></div>
            <div className="card perk"><i>🔑</i><span>ดูรหัสได้เองที่ &quot;บัญชีของฉัน&quot;</span></div>
          </div>
          {p.description && <div className="card desc"><h3>รายละเอียด</h3><p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{p.description}</p></div>}
        </div>
      </div>
    </>
  );
}
