import { to } from '@/lib/routes';
import 'server-only';
import { after } from 'next/server';
import { db } from '@/lib/db';
import type { Shop } from '@/lib/shop';

/**
 * แจ้งเตือนร้านผ่าน Discord Webhook (shops.discord_webhook)
 * ส่งหลังตอบลูกค้าแล้ว (after) · ส่งไม่สำเร็จ = แค่ log ไม่ทำให้การจ่ายเงิน/ออเดอร์ล้ม
 * ยังไม่รัน 0009 / ร้านไม่ได้ตั้ง = ไม่ส่ง
 */
export type NotifyEvent = 'order' | 'manual' | 'topup' | 'stock' | 'signup' | 'report';
export const NOTIFY_EVENTS: [NotifyEvent, string][] = [
  ['order', 'ออเดอร์ใหม่ (จ่ายแล้ว)'], ['manual', 'ออเดอร์ที่ร้านต้องทำเอง (แท็ก @here)'], ['topup', 'ลูกค้าเติมเงิน'], ['stock', 'ของใกล้หมด (เหลือ ≤ 3)'], ['signup', 'สมาชิกใหม่'],
];
export const DISCORD_URL = /^https:\/\/(ptb\.|canary\.)?(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const COLOR = { order: 0x22c55e, manual: 0xf59e0b, topup: 0x6366f1, stock: 0xef4444, signup: 0x0ea5e9, report: 0xdc2626 };
const baht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

type Embed = { title: string; description?: string; color: number; fields?: { name: string; value: string; inline?: boolean }[]; url?: string; image?: { url: string } };

function adminUrl(shop: Pick<Shop, 'slug'>, path: string) {
  const root = process.env.SHOP_ROOT_DOMAIN || 'sysrent.shop';
  return `https://${shop.slug}.${root}${path}`;
}

async function settings(shopId: string): Promise<{ url: string; events: string[] } | null> {
  const { data, error } = await db().from('shops').select('discord_webhook, discord_events').eq('id', shopId).maybeSingle();
  if (error || !data?.discord_webhook || !DISCORD_URL.test(data.discord_webhook)) return null;
  return { url: data.discord_webhook, events: (data.discord_events as string[] | null) ?? [] };
}

/** ส่งข้อความเข้า Discord (ใช้ตอนทดสอบด้วย → คืนผล) */
export async function postDiscord(url: string, shopName: string, embeds: Embed[], content?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        username: shopName.slice(0, 80) || 'ร้านค้า',
        content, allowed_mentions: { parse: content?.includes('@here') ? ['everyone'] : [] },
        embeds: embeds.map((e) => ({ ...e, timestamp: new Date().toISOString(), footer: { text: 'SysRent Shop' } })),
      }),
    });
    if (r.ok) return { ok: true };
    if (r.status === 404 || r.status === 401) return { ok: false, error: 'ลิงก์ Webhook ใช้ไม่ได้ (อาจถูกลบใน Discord แล้ว)' };
    return { ok: false, error: `Discord ตอบกลับ ${r.status}` };
  } catch {
    return { ok: false, error: 'เชื่อมต่อ Discord ไม่ได้' };
  }
}

function fire(shop: Pick<Shop, 'id' | 'name'>, event: NotifyEvent, build: () => Promise<{ embeds: Embed[]; content?: string } | null>) {
  after(async () => {
    const s = await settings(shop.id);
    if (!s || !s.events.includes(event)) return;
    const msg = await build();
    if (!msg) return;
    const r = await postDiscord(s.url, shop.name, msg.embeds, msg.content);
    if (!r.ok) console.error('[discord]', shop.id, r.error);
  });
}

/** ออเดอร์จ่ายแล้ว → แจ้งออเดอร์ · มีรายการสั่งทำ = แจ้งแยก (แท็ก @here) · ของใกล้หมด = แจ้งแยก */
export function notifyOrderPaid(shop: Pick<Shop, 'id' | 'name' | 'slug'>, orderId: string) {
  const load = async () => {
    const { data: o } = await db().from('shop_orders').select('code, total, paid_by, shop_customers(username), shop_order_items(name, qty, total, fulfillment, option_id, product_id)').eq('id', orderId).maybeSingle();
    return o as unknown as { code: string; total: number; paid_by: string | null; shop_customers: { username: string } | null; shop_order_items: { name: string; qty: number; total: number; fulfillment: string; option_id: string; product_id: string }[] } | null;
  };
  const items = (o: NonNullable<Awaited<ReturnType<typeof load>>>) => o.shop_order_items.map((i) => `• ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''} — ${baht(Number(i.total))}`).join('\n').slice(0, 1000);

  fire(shop, 'order', async () => {
    const o = await load();
    if (!o) return null;
    return { embeds: [{
      title: `🛒 ออเดอร์ใหม่ #${o.code}`, color: COLOR.order, url: adminUrl(shop, to('/admin/orders')), description: items(o),
      fields: [
        { name: 'ยอด', value: baht(Number(o.total)), inline: true },
        { name: 'ลูกค้า', value: o.shop_customers ? `@${o.shop_customers.username}` : '—', inline: true },
        { name: 'จ่ายด้วย', value: o.paid_by === 'wallet' ? 'กระเป๋าเงิน' : 'พร้อมเพย์', inline: true },
      ],
    }] };
  });

  fire(shop, 'manual', async () => {
    const o = await load();
    const manual = o?.shop_order_items.filter((i) => i.fulfillment === 'manual') ?? [];
    if (!o || !manual.length) return null;
    return { content: '@here มีออเดอร์รอร้านดำเนินการ', embeds: [{
      title: `⏳ ต้องทำเอง · ออเดอร์ #${o.code}`, color: COLOR.manual, url: adminUrl(shop, to('/admin/orders')),
      description: manual.map((i) => `• ${i.name}`).join('\n').slice(0, 1000),
      fields: [{ name: 'ลูกค้า', value: o.shop_customers ? `@${o.shop_customers.username}` : '—', inline: true }],
    }] };
  });

  fire(shop, 'stock', async () => {
    const o = await load();
    if (!o) return null;
    const d = db();
    const optIds = o.shop_order_items.filter((i) => i.fulfillment === 'stock').map((i) => i.option_id);
    const prodIds = o.shop_order_items.filter((i) => i.fulfillment === 'slot').map((i) => i.product_id);
    const low: string[] = [];
    if (optIds.length) {
      const { data } = await d.from('shop_option_stock').select('option_id, available').in('option_id', optIds);
      for (const id of optIds) {
        const left = data?.find((r) => r.option_id === id)?.available ?? 0;
        if (left <= 3) low.push(`• ${o.shop_order_items.find((i) => i.option_id === id)!.name} — เหลือ ${left}`);
      }
    }
    if (prodIds.length) {
      const { data } = await d.from('shop_free_slots').select('product_id, free').in('product_id', prodIds);
      for (const id of prodIds) {
        const left = data?.find((r) => r.product_id === id)?.free ?? 0;
        if (left <= 3) low.push(`• ${o.shop_order_items.find((i) => i.product_id === id)!.name.split(' · ')[0]} — เหลือ ${left} จอ`);
      }
    }
    if (!low.length) return null;
    return { embeds: [{ title: '📦 ของใกล้หมด', color: COLOR.stock, url: adminUrl(shop, to('/admin/products')), description: [...new Set(low)].join('\n').slice(0, 1000) }] };
  });
}

/** ลูกค้าเติมเงินสำเร็จ */
export function notifyTopup(shop: Pick<Shop, 'id' | 'name' | 'slug'>, username: string, amount: number) {
  fire(shop, 'topup', async () => ({ embeds: [{
    title: `💳 เติมเงิน ${baht(amount)}`, color: COLOR.topup, url: adminUrl(shop, to('/admin/customers')),
    fields: [{ name: 'ลูกค้า', value: `@${username}`, inline: true }],
  }] }));
}

/** ลูกค้าสมัครสมาชิกใหม่ (+ ช่องทางติดต่อที่กรอกไว้ · จำนวนสมาชิกทั้งหมด) */
export function notifySignup(shop: Pick<Shop, 'id' | 'name' | 'slug'>, username: string, contact: string) {
  fire(shop, 'signup', async () => {
    const { count } = await db().from('shop_customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id);
    return { embeds: [{
      title: '👋 สมาชิกใหม่', color: COLOR.signup, url: adminUrl(shop, to('/admin/customers')),
      fields: [
        { name: 'ชื่อผู้ใช้', value: `@${username}`, inline: true },
        { name: 'ติดต่อ', value: contact || '—', inline: true },
        { name: 'สมาชิกทั้งหมด', value: `${(count ?? 0).toLocaleString('th-TH')} คน`, inline: true },
      ],
    }] };
  });
}

/** ลูกค้าแจ้งปัญหาออเดอร์ (แท็ก @here ให้ร้านเห็นเร็ว) */
export function notifyReport(shop: Pick<Shop, 'id' | 'name' | 'slug'>, username: string, code: string, topic: string, message: string, image = '') {
  fire(shop, 'report', async () => ({ content: '@here ลูกค้าแจ้งปัญหา', embeds: [{
    title: `⚠️ แจ้งปัญหา · ออเดอร์ #${code}`, color: COLOR.report, url: adminUrl(shop, to('/admin/reports')),
    description: message.slice(0, 1000) || undefined,
    fields: [{ name: 'เรื่อง', value: topic, inline: true }, { name: 'ลูกค้า', value: `@${username}`, inline: true }],
    ...(image ? { image: { url: image } } : {}),
  }] }));
}
