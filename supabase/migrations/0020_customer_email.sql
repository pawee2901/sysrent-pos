-- =============================================================
-- SysRent Shop · 0020 อีเมลลูกค้า (รับแจ้งเตือนเมื่อร้านส่งสินค้าสั่งทำ / คืนเงิน)
-- รันใน Supabase → SQL Editor หลัง 0019 (รันซ้ำได้)
-- =============================================================
alter table public.shop_customers add column if not exists email text not null default '';
