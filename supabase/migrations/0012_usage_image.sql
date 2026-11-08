-- =============================================================
-- SysRent Shop · 0012 รูปวิธีการใช้งาน (ลูกค้าเห็น + ดาวน์โหลดได้หลังซื้อ)
-- รันใน Supabase → SQL Editor หลัง 0011 (รันซ้ำได้)
-- =============================================================
alter table public.shop_products add column if not exists usage_image text not null default '';
