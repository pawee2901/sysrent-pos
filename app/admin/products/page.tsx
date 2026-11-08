import { adminShop } from '@/lib/admin-page';
import { loadProducts } from '@/lib/catalog';
import { ProductsClient } from './ProductsClient';
import { db } from '@/lib/db';
import { agentPrices } from '@/lib/agents';
import { can } from '@/lib/plan';
import { mergeCategories, shopCategories } from '@/lib/categories';

export default async function AdminProducts() {
  const shop = await adminShop('products');
  if (!shop) return null;
  const [products, list] = await Promise.all([loadProducts(shop.id, { includeHidden: true }), shopCategories(shop.id)]);
  const agentsOn = can(shop.plan, 'agents');
  let u = await db().from('shop_products').select('id, usage, usage_image').eq('shop_id', shop.id);
  const imgReady = !u.error;
  if (u.error) u = await db().from('shop_products').select('id, usage').eq('shop_id', shop.id) as typeof u; // ยังไม่รัน 0012
  const usages: Record<string, string> = u.error ? {} : Object.fromEntries((u.data ?? []).map((r) => [r.id as string, (r.usage as string) ?? '']));
  const usageImages: Record<string, string> = !imgReady ? {} : Object.fromEntries((u.data ?? []).map((r) => [r.id as string, ((r as { usage_image?: string }).usage_image) ?? '']));
  return <ProductsClient products={products} categories={mergeCategories(list, products.map((p) => p.category))} usages={usages} usageReady={!u.error} usageImages={usageImages} imgReady={imgReady} agentPrices={agentsOn ? await agentPrices(products.flatMap((p) => p.options.map((o) => o.id))) : {}} agentsOn={agentsOn} />;
}
