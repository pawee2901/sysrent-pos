-- =============================================================
-- 0025 ค้นหา OTP: รองรับ Hotmail / Outlook (ต้องรัน 0024 มาก่อน)
-- รันใน Supabase → SQL Editor ทั้งไฟล์ครั้งเดียว
-- =============================================================

alter table public.shop_otp_mailboxes drop constraint if exists shop_otp_mailboxes_provider_check;
alter table public.shop_otp_mailboxes add constraint shop_otp_mailboxes_provider_check check (provider in ('gmail', 'maily', 'graph'));
