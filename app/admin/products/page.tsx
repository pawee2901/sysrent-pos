import { adminShop } from '@/lib/admin-page';
import { loadProducts } from '@/lib/catalog';
import { ProductsClient } from './ProductsClient';
import type { DForm } from './DeliveryForm';
import { agentPrices } from '@/lib/agents';
import { can } from '@/lib/plan';
import { mergeCategories, shopCategories } from '@/lib/categories';
import { productMedia } from '@/lib/media';
import { db } from '@/lib/db';

export default async function AdminProducts() {
  const shop = await adminShop('products');
  if (!shop) return null;
  const [products, list, media] = await Promise.all([loadProducts(shop.id, { includeHidden: true }), shopCategories(shop.id), productMedia({ shopId: shop.id })]);
  const agentsOn = can(shop.plan, 'agents');
  // ปุ่มรับ OTP: แอปที่ร้านตั้งไว้ในหน้า OTP + แอปที่แต่ละสินค้าเลือก (ร้านไม่มีฟีเจอร์ OTP / ยังไม่รัน 0032 = ไม่แสดงช่องนี้)
  const otpOn = can(shop.plan, 'otp');
  const [otpAppRows, otpPicks] = otpOn ? await Promise.all([
    db().from('shop_otp_apps').select('id, name').eq('shop_id', shop.id).order('sort').order('created_at'),
    db().from('shop_products').select('id, otp_app_id').eq('shop_id', shop.id),
  ]) : [null, null];
  const otp = otpOn ? {
    ready: !otpPicks?.error, apps: (otpAppRows?.data ?? []) as { id: string; name: string }[],
    picks: Object.fromEntries(((otpPicks?.data ?? []) as { id: string; otp_app_id: string | null }[]).filter((r) => r.otp_app_id).map((r) => [r.id, r.otp_app_id as string])),
  } : null;
  // ฟอร์มส่งของของแต่ละแพ็กเกจ (ยังไม่รัน 0046 = ไม่มีฟอร์ม ใช้ได้ปกติ)
  const optIds = products.flatMap((p) => p.options.map((o) => o.id));
  const fq = optIds.length ? await db().from('shop_options').select('id, delivery_form').in('id', optIds) : { data: [], error: null };
  const lq = optIds.length ? await db().from('shop_options').select('id, otp_limit').in('id', optIds) : { data: [] };
  const limits = Object.fromEntries(((lq.data ?? []) as { id: string; otp_limit: number }[]).filter((r) => r.otp_limit > 0).map((r) => [r.id, r.otp_limit]));
  const forms = Object.fromEntries(((fq.data ?? []) as { id: string; delivery_form: DForm | null }[]).filter((r) => r.delivery_form?.tpl).map((r) => [r.id, r.delivery_form as DForm]));
  const pick = <T,>(fn: (m: { usage: string; usageImages: string[]; images: string[] }) => T) => Object.fromEntries([...media.map].map(([id, m]) => [id, fn(m)]));
  return <ProductsClient products={products} categories={mergeCategories(list, products.map((p) => p.category))}
    usages={pick((m) => m.usage)} usageImages={pick((m) => m.usageImages)} images={pick((m) => m.images)}
    usageReady={media.level !== 'none'} imgReady={media.level === 'multi' || media.level === 'single'} galleryReady={media.level === 'multi'}
    agentPrices={agentsOn ? await agentPrices(products.flatMap((p) => p.options.map((o) => o.id))) : {}} agentsOn={agentsOn} otp={otp} forms={forms} formReady={!fq.error} limits={limits} />;
}
