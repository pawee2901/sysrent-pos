-- =============================================================
-- SysRent Shop · 0050 จำกัดการรับรหัส OTP ของลูกค้า
--   cust_limit = รับรหัสได้กี่ครั้งต่อ 1 อีเมล ต่อ cust_period (0 = ไม่จำกัด)
--   ใช้กับลูกค้าที่ล็อกอินค้นในเว็บ และหน้ารับ OTP แบบไม่ใช้รหัสตัวแทน (ระบบตัวแทนใช้โควตาของแต่ละรหัสแทน)
--   นับเฉพาะครั้งที่เจอรหัส · ยังไม่รันไฟล์นี้ = ไม่จำกัด (เหมือนเดิม)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_otp_config add column if not exists cust_limit int not null default 0;
alter table public.shop_otp_config add column if not exists cust_period text not null default 'day';
alter table public.shop_otp_config drop constraint if exists shop_otp_config_cust_limit;
alter table public.shop_otp_config add constraint shop_otp_config_cust_limit check (cust_limit between 0 and 1000 and cust_period in ('day', 'week', 'month'));
create index if not exists shop_otp_requests_account on public.shop_otp_requests (shop_id, account, created_at desc);
