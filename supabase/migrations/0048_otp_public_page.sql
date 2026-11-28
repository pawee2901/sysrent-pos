-- =============================================================
-- SysRent Shop · 0048 หน้ารับ OTP (ไม่ต้องล็อกอิน)
--   ร้านเปิดสวิตช์ → ใครมีลิงก์ก็เลือกแอป กรอกอีเมล แล้วรับรหัสได้
--   ค้นได้เฉพาะอีเมลที่อยู่ในสินค้าของร้านที่ขายไปแล้วและยังไม่หมดอายุ · จำกัดจำนวนครั้งต่อ IP
--   ยังไม่รันไฟล์นี้ = เปิดหน้ารับ OTP ไม่ได้ (ลูกค้าที่ล็อกอินค้นได้ตามเดิม)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_otp_config add column if not exists public_page boolean not null default false;
-- คำขอจากหน้ารับ OTP ไม่มีลูกค้า → customer_id ว่างได้ · เก็บ IP ไว้จำกัดจำนวนครั้ง
alter table public.shop_otp_requests alter column customer_id drop not null;
alter table public.shop_otp_requests add column if not exists ip text;
create index if not exists shop_otp_requests_ip on public.shop_otp_requests (shop_id, ip, created_at desc) where ip is not null;
