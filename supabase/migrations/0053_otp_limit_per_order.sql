-- =============================================================
-- SysRent Shop · 0053 จำกัดการรับรหัสของลูกค้าแบบ "ต่อออเดอร์" (ค่าเริ่มต้นของทั้งร้าน)
--   cust_period = 'order' → 1 ออเดอร์ขอรหัสได้ cust_limit ครั้ง (ทุกแพ็กเกจ · แพ็กเกจที่ตั้งเองในหน้าสต็อกใช้ค่าของแพ็กเกจแทน)
--   ต้องรัน 0050 มาก่อน · รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_otp_config alter column cust_period set default 'order';
alter table public.shop_otp_config drop constraint if exists shop_otp_config_cust_limit;
alter table public.shop_otp_config add constraint shop_otp_config_cust_limit check (cust_limit between 0 and 1000 and cust_period in ('order', 'day', 'week', 'month'));
