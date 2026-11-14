import { adminShop } from '@/lib/admin-page';
import { loadProducts } from '@/lib/catalog';
import { ProductsClient } from './ProductsClient';
import { agentPrices } from '@/lib/agents';
import { can } from '@/lib/plan';
import { mergeCategories, shopCategories } from '@/lib/categories';
import { productMedia } from '@/lib/media';

export default async function AdminProducts() {
  const shop = await adminShop('products');
  if (!shop) return null;
  const [products, list, media] = await Promise.all([loadProducts(shop.id, { includeHidden: true }), shopCategories(shop.id), productMedia({ shopId: shop.id })]);
  const agentsOn = can(shop.plan, 'agents');
  const pick = <T,>(fn: (m: { usage: string; usageImages: string[]; images: string[] }) => T) => Object.fromEntries([...media.map].map(([id, m]) => [id, fn(m)]));
  return <ProductsClient products={products} categories={mergeCategories(list, products.map((p) => p.category))}
    usages={pick((m) => m.usage)} usageImages={pick((m) => m.usageImages)} images={pick((m) => m.images)}
    usageReady={media.level !== 'none'} imgReady={media.level === 'multi' || media.level === 'single'} galleryReady={media.level === 'multi'}
    agentPrices={agentsOn ? await agentPrices(products.flatMap((p) => p.options.map((o) => o.id))) : {}} agentsOn={agentsOn} />;
}
