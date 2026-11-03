import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { db } from '@/lib/db';

export type Shop = {
  id: string; slug: string; owner_id: string | null; name: string; tagline: string; logo_url: string; accent: string;
  line_url: string; announcement: string; promptpay_id: string; receiver_name: string; plan: string;
  slip_quota: number; slip_overage: number; active: boolean; expires_at: string | null;
};
export const SHOP_COLS = 'id, slug, owner_id, name, tagline, logo_url, accent, line_url, announcement, promptpay_id, receiver_name, plan, slip_quota, slip_overage, active, expires_at';

/** slug ร้านจาก subdomain เช่น muay.sysrent.shop → 'muay' (ตอนรันในเครื่องใช้ DEV_SHOP_SLUG) */
export async function shopSlug(): Promise<string | null> {
  const host = ((await headers()).get('host') ?? '').split(':')[0].toLowerCase();
  const root = (process.env.SHOP_ROOT_DOMAIN ?? 'sysrent.shop').toLowerCase();
  if (host.endsWith('.' + root)) {
    const sub = host.slice(0, -(root.length + 1));
    return /^[a-z0-9-]{3,30}$/.test(sub) ? sub : null;
  }
  return process.env.NODE_ENV !== 'production' ? process.env.DEV_SHOP_SLUG || null : null;
}

/** ร้านของ request นี้ (ถามฐานข้อมูลครั้งเดียวต่อ request) */
export const getShop = cache(async (): Promise<Shop | null> => {
  const slug = await shopSlug();
  if (!slug) return null;
  const { data } = await db().from('shops').select(SHOP_COLS).eq('slug', slug).maybeSingle();
  return data ? ({ ...data, slip_overage: Number(data.slip_overage) } as Shop) : null;
});

/** ร้านเปิดให้ซื้อได้ไหม (ระงับ / หมดอายุเกิน 2 วัน = ปิด) */
export function shopOpen(s: Shop): boolean {
  if (!s.active) return false;
  if (!s.expires_at) return true;
  return new Date(s.expires_at).getTime() + 2 * 86_400_000 > Date.now();
}

export const ACCENTS: Record<string, string> = { indigo: '#5b5bd6', pink: '#e64980', emerald: '#0d9f6e', orange: '#ea6a12', sky: '#0e8fd1' };
export const baht = (n: number) => '฿' + Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });
