import { adminShop } from '@/lib/admin-page';
import { loadProducts } from '@/lib/catalog';
import { ProductsClient } from './ProductsClient';

export default async function AdminProducts() {
  const shop = await adminShop();
  if (!shop) return null;
  return <ProductsClient products={await loadProducts(shop.id, { includeHidden: true })} />;
}
