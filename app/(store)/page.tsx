import { getShop } from '@/lib/shop';
import { db } from '@/lib/db';
import { parseLayout } from '@/lib/home-layout';
import { Blocks } from '@/components/Blocks';

export const dynamic = 'force-dynamic';

/** หน้าแรกร้าน: กล่องที่ร้านจัดไว้ (ยังไม่จัด / ยังไม่รัน 0034 = หัวเว็บ · คนเพิ่งซื้อ · ตัวเลข · สินค้า · ขั้นตอนซื้อ) */
export default async function Home({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const shop = (await getShop())!;
  const { c = '', q = '' } = await searchParams;
  const { data } = await db().from('shops').select('home_layout').eq('id', shop.id).maybeSingle();
  return <Blocks blocks={parseLayout(data?.home_layout)} c={c} q={q} />;
}
