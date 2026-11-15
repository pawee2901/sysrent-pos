import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getShop } from '@/lib/shop';
import { db } from '@/lib/db';
import { PAGE_SLUG, parseLayout } from '@/lib/home-layout';
import { Blocks } from '@/components/Blocks';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  if (!PAGE_SLUG.test(slug)) return null;
  const shop = await getShop();
  if (!shop) return null;
  // ยังไม่รัน 0035 = error → ไม่พบหน้า
  const { data } = await db().from('shop_pages').select('title, blocks').eq('shop_id', shop.id).eq('slug', slug).maybeSingle();
  return data ? { shop, title: data.title as string, blocks: data.blocks as unknown } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: `${p.title} · ${p.shop.name}` } : {};
}

/** หน้าเพิ่มเติมที่ร้านสร้างเอง (/s/ชื่อหน้า) */
export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const blocks = Array.isArray(p.blocks) && p.blocks.length ? parseLayout(p.blocks) : [];
  return blocks.length ? <Blocks blocks={blocks} />
    : <div className="card success" style={{ marginTop: 24 }}><h1 style={{ fontSize: 22 }}>{p.title}</h1><p className="muted">หน้านี้ยังไม่มีเนื้อหา</p></div>;
}
