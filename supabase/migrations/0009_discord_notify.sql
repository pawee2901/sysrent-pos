-- =============================================================
-- SysRent Shop · 0009 แจ้งเตือนร้านผ่าน Discord (Webhook ของห้องในเซิร์ฟเวอร์ร้าน)
--   discord_webhook = ลิงก์ Webhook (ร้านสร้างเองใน Discord: ตั้งค่าห้อง → Integrations → Webhooks)
--   discord_events  = เรื่องที่อยากให้แจ้ง: order (ออเดอร์จ่ายแล้ว) · manual (ออเดอร์ที่ร้านต้องทำเอง)
--                     · topup (ลูกค้าเติมเงิน) · stock (ของใกล้หมด) · signup (สมาชิกใหม่)
-- รันใน Supabase → SQL Editor หลัง 0008 (รันซ้ำได้)
-- =============================================================
alter table public.shops
  add column if not exists discord_webhook text not null default '',
  add column if not exists discord_events  text[] not null default '{order,manual,topup,stock,signup}';
alter table public.shops alter column discord_events set default '{order,manual,topup,stock,signup}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shops_discord_webhook_check') then
    alter table public.shops add constraint shops_discord_webhook_check
      check (discord_webhook = '' or discord_webhook ~ '^https://(ptb\.|canary\.)?(discord|discordapp)\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$');
  end if;
end $$;
