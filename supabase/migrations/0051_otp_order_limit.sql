-- =============================================================
-- SysRent Shop · 0051 จำกัดการขอ OTP ต่อออเดอร์ (ตั้งที่แพ็กเกจ)
--   shop_options.otp_limit = 1 ออเดอร์ของแพ็กเกจนี้ ขอ OTP ได้กี่ครั้ง (0 = ไม่จำกัด) เช่น NF 5 วัน = 1
--   ลูกค้าต้องติ๊กยอมรับก่อนค้นหา · นับเฉพาะครั้งที่ได้รหัส
--   ยังไม่รันไฟล์นี้ = ไม่จำกัด (เหมือนเดิม)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_options add column if not exists otp_limit int not null default 0;
alter table public.shop_options drop constraint if exists shop_options_otp_limit;
alter table public.shop_options add constraint shop_options_otp_limit check (otp_limit between 0 and 100);
alter table public.shop_otp_requests add column if not exists order_item_id uuid references public.shop_order_items(id) on delete set null;
create index if not exists shop_otp_requests_item on public.shop_otp_requests (order_item_id) where order_item_id is not null;
