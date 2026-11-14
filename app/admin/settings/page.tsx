import { db } from '@/lib/db';
import { can } from '@/lib/plan';
import { ownedThemes } from '@/lib/themes';
import { adminShop } from '@/lib/admin-page';
import { SettingsClient } from './SettingsClient';

export default async function AdminSettings() {
  const shop = await adminShop('settings');
  if (!shop) return null;
  const d = db();
  const { data } = await d.from('shops').select('admin_username').eq('id', shop.id).single();
  // Discord (ยังไม่รัน 0009 = error → การ์ดแสดงคำเตือน) · ไม่ส่งลิงก์เต็มไปหน้าเว็บ แค่ 6 ตัวท้ายไว้ให้จำได้
  const ap = await d.from('shops').select('font, effect, loader, music_url').eq('id', shop.id).maybeSingle(); // ยังไม่รัน 0022 = error
  const sm = await d.from('shops').select('smtp_user').eq('id', shop.id).maybeSingle(); // ยังไม่รัน 0021 = error
  const pc = await d.from('shops').select('promo_cards').eq('id', shop.id).maybeSingle(); // ยังไม่รัน 0031 = error
  const dc = await d.from('shops').select('discord_webhook, discord_events').eq('id', shop.id).maybeSingle();
  const discord = { ready: !dc.error, set: !!dc.data?.discord_webhook, hint: (dc.data?.discord_webhook ?? '').slice(-6), events: (dc.data?.discord_events as string[] | null) ?? ['order', 'manual', 'topup', 'stock', 'signup', 'report'] };
  return <SettingsClient promos={{ ready: !pc.error, cards: Array.isArray(pc.data?.promo_cards) ? (pc.data.promo_cards as { image: string; link: string }[]) : [] }} initial={{ name: shop.name, tagline: shop.tagline, logo_url: shop.logo_url, accent: shop.accent, line_url: shop.line_url, announcement: shop.announcement,
    promptpay_id: shop.promptpay_id, receiver_name: shop.receiver_name }}
    look={{ facebook_url: shop.facebook_url, banner_url: shop.banner_url, banner_link: shop.banner_link, popup_text: shop.popup_text, popup_image: shop.popup_image, popup_link: shop.popup_link, bg_style: shop.bg_style, bg_image: shop.bg_image, bg_color: shop.bg_color ?? '', card_style: shop.card_style ?? 'white' }} theme={shop.theme ?? 'modern'} owned={ownedThemes(shop.plan, shop.themes_owned)} slug={shop.slug} admin={data?.admin_username ?? 'admin'} discord={discord} mail={{ enabled: can(shop.plan, 'mail'), ready: !sm.error, email: sm.data?.smtp_user ?? '' }}
    appearance={{ enabled: can(shop.plan, 'appearance'), ready: !ap.error, font: ap.data?.font ?? '', effect: ap.data?.effect ?? 'none', loader: ap.data?.loader ?? 'none', music_url: ap.data?.music_url ?? '' }} />;
}
