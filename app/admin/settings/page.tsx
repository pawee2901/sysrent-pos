import { db } from '@/lib/db';
import { adminShop } from '@/lib/admin-page';
import { SettingsClient } from './SettingsClient';

export default async function AdminSettings() {
  const shop = await adminShop();
  if (!shop) return null;
  const { data } = await db().from('shops').select('admin_username').eq('id', shop.id).single();
  return <SettingsClient initial={{ name: shop.name, tagline: shop.tagline, logo_url: shop.logo_url, accent: shop.accent, line_url: shop.line_url, announcement: shop.announcement,
    promptpay_id: shop.promptpay_id, receiver_name: shop.receiver_name }} slug={shop.slug} admin={data?.admin_username ?? 'admin'} />;
}
