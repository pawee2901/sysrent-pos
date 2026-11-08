-- =============================================================
-- SysRent Shop · 0007 หมวดหมู่สินค้า (ร้านเพิ่ม / เปลี่ยนชื่อ / เรียงลำดับ / ลบเองได้)
--   categories = รายชื่อหมวดเรียงตามลำดับที่แสดงหน้าร้าน (สินค้าเก็บชื่อหมวดใน shop_products.category เหมือนเดิม)
-- รันใน Supabase → SQL Editor หลัง 0006 (รันซ้ำได้)
-- =============================================================
alter table public.shops add column if not exists categories text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shops_categories_check') then
    alter table public.shops add constraint shops_categories_check check (cardinality(categories) <= 40);
  end if;
end $$;
