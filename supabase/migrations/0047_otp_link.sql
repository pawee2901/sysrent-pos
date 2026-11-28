-- =============================================================
-- SysRent Shop · 0047 ค้นหา OTP: ร้านเลือกได้ว่าให้ลูกค้าค้นในเว็บร้าน หรือส่งไปลิงก์เว็บ OTP อื่น
--   otp_link = null / ว่าง → ค้นในเว็บร้าน (แบบเดิม) · มีลิงก์ → ปุ่ม / เมนู OTP ทุกที่พาไปลิงก์นั้น
--   ยังไม่รันไฟล์นี้ = ค้นในเว็บร้านตามเดิม
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_otp_config add column if not exists otp_link text;
alter table public.shop_otp_config drop constraint if exists shop_otp_config_link_len;
alter table public.shop_otp_config add constraint shop_otp_config_link_len check (otp_link is null or (char_length(otp_link) <= 500 and otp_link ~ '^https://'));
