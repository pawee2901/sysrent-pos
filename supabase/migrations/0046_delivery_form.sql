-- =============================================================
-- SysRent Shop · 0046 ฟอร์มส่งของ (ต่อแพ็กเกจ)
--   ร้านวางข้อความที่เคยส่งลูกค้า แตะคำที่เปลี่ยน = ช่อง → เติมสต็อกใส่แค่ค่า
--   { tpl: 'ข้อความ {{0}} ...', fields: ['อีเมล', ...] } · null = ไม่มีฟอร์ม
--   ยังไม่รันไฟล์นี้ = ใช้ฟอร์มได้ แต่ระบบจำฟอร์มไว้ไม่ได้
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_options add column if not exists delivery_form jsonb;
alter table public.shop_options drop constraint if exists shop_options_delivery_form_len;
alter table public.shop_options add constraint shop_options_delivery_form_len check (delivery_form is null or pg_column_size(delivery_form) <= 8000);
