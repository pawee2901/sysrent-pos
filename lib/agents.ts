import 'server-only';
import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import type { Product } from '@/lib/catalog';
import type { Shop } from '@/lib/shop';

/**
 * ระบบตัวแทน (ซื้อราคาส่ง) — เฉพาะร้านแพ็กเกจ Pro
 * ราคาจริงตอนสั่งคิดในฐานข้อมูล (shop_create_order) · ไฟล์นี้แค่ไว้ "แสดง" ราคาตัวแทนบนหน้าเว็บ
 * ยังไม่รัน SQL 0016 = ไม่มีตัวแทน (หน้าเว็บไม่พัง)
 */
export async function getAgent(shop: Pick<Shop, 'id' | 'plan'>, customerId: string | null | undefined): Promise<{ id: string; code: string } | null> {
  if (!customerId || !can(shop.plan, 'agents')) return null;
  const { data, error } = await db().from('shop_agents').select('id, code').eq('shop_id', shop.id).eq('customer_id', customerId).eq('active', true).maybeSingle();
  return error || !data ? null : data;
}

/** ราคาตัวแทนของแพ็กเกจที่ระบุ { option_id: ราคา } */
export async function agentPrices(optionIds: string[]): Promise<Record<string, number>> {
  if (!optionIds.length) return {};
  const { data, error } = await db().from('shop_agent_prices').select('option_id, agent_price').in('option_id', optionIds);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [r.option_id as string, Number(r.agent_price)]));
}

/** สินค้าในมุมของตัวแทน: ราคา = ราคาตัวแทน · ราคาขีดฆ่า = ราคาปกติ (ไม่ได้ตั้ง = ราคาปกติ) */
export function withAgentPrices(products: Product[], prices: Record<string, number>): Product[] {
  return products.map((p) => {
    const options = p.options.map((o) => {
      const ap = prices[o.id];
      return ap !== undefined && ap < o.price ? { ...o, price: ap, compareAt: o.price } : o;
    });
    const live = options.filter((o) => o.active);
    return { ...p, options, from: live.length ? Math.min(...live.map((o) => o.price)) : p.from };
  });
}
