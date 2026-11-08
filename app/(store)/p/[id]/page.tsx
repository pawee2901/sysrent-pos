import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getShop, baht, shopOpen } from '@/lib/shop';
import { loadProducts } from '@/lib/catalog';
import { getAgent, agentPrices, withAgentPrices } from '@/lib/agents';
import { getCustomer } from '@/lib/auth';
import { AppLogo } from '@/components/AppLogo';
import { BuyBox } from './BuyBox';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const shop = (await getShop())!;
  const [[base], me] = await Promise.all([loadProducts(shop.id, { id }), getCustomer()]);
  if (!base) notFound();
  // ตัวแทน (ร้าน Pro): ราคาตัวแทน (ราคาปกติขีดฆ่า) — ราคาจริงคิดในฐานข้อมูลตอนสั่ง
  const agent = await getAgent(shop, me?.id);
  const p = agent ? withAgentPrices([base], await agentPrices(base.options.map((o) => o.id)))[0] : base;
  return (
    <>
      <nav className="crumb" aria-label="เส้นทาง"><Link href="/">หน้าแรก</Link><i>›</i>{p.category && <><span>{p.category}</span><i>›</i></>}<b>{p.name}</b></nav>
      <div className="pd">
        <div className="card pd-media"><AppLogo image={p.image} template={p.template} name={p.name} size="xl" /></div>
        <div>
          {p.badge && <span className="pill accent plain">{p.badge}</span>}
          {agent && <span className="pill ok" style={{ marginLeft: p.badge ? 6 : 0 }}>🤝 ราคาตัวแทน</span>}
          <h1>{p.name}</h1>
          <div className="pd-sub">
            <span>ขายแล้ว {p.sold.toLocaleString('th-TH')}</span>
            {p.inStock ? <span className="pill ok">{p.left === null ? 'พร้อมส่ง' : `พร้อมส่ง ${p.left}`}</span> : <span className="pill bad">หมดชั่วคราว</span>}
            {p.from !== null && <span>เริ่ม {baht(p.from)}</span>}
          </div>
          <BuyBox open={shopOpen(shop)} product={{ id: p.id, name: p.name, image: p.image, template: p.template, fulfillment: p.fulfillment, askInfo: p.askInfo }} options={p.options}>
            {/* รายละเอียดอยู่เหนือปุ่ม ใส่ตะกร้า / ซื้อเลย → อ่านเงื่อนไขก่อนกดซื้อ */}
            {p.description && <div className="card desc"><h3>รายละเอียด</h3><p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{p.description}</p></div>}
          </BuyBox>
          <div className="perks">
            <div className="card perk"><i>⚡</i><span>{p.fulfillment === 'manual' ? 'สินค้าสั่งทำ: จ่ายแล้วร้านทำให้ รับของได้ที่หน้าประวัติการซื้อ' : 'จ่ายแล้วได้รหัสทันที ไม่ต้องรอแอดมิน'}</span></div>
            <div className="card perk"><i>🛡️</i><span>รับประกันตลอดอายุแพ็กเกจ</span></div>
            <div className="card perk"><i>🔑</i><span>ดูรหัสได้เองที่ &quot;บัญชีของฉัน&quot;</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
