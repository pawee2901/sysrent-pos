-- =============================================================
-- SysRent Shop · 0054 เว็บรับ OTP: ชื่อเว็บ + โลโก้ แยกจากร้าน
--   site_name / site_logo ว่าง = ใช้ชื่อ / โลโก้ของร้าน
--   ยังไม่รันไฟล์นี้ = ใช้ชื่อ / โลโก้ของร้าน (เหมือนเดิม)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_otp_config add column if not exists site_name text not null default '';
alter table public.shop_otp_config add column if not exists site_logo text not null default '';
alter table public.shop_otp_config drop constraint if exists shop_otp_config_site_brand;
alter table public.shop_otp_config add constraint shop_otp_config_site_brand check (char_length(site_name) <= 40 and char_length(site_logo) <= 500 and (site_logo = '' or site_logo ~ '^https://'));
