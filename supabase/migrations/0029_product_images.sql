-- =============================================================
-- 0029 รูปหลายรูปต่อสินค้า — รันซ้ำได้
--   images        = รูปสินค้าเพิ่มเติม (ลูกค้าเห็นในหน้าสินค้า · รูปหลัก/โลโก้ยังอยู่ที่ image)
--   usage_images  = รูปวิธีการใช้งาน (ลูกค้าเห็นหลังซื้อ) แทน usage_image ที่ใส่ได้รูปเดียว
-- =============================================================
alter table public.shop_products
  add column if not exists images       text[] not null default '{}',
  add column if not exists usage_images text[] not null default '{}';

-- ย้ายรูปวิธีใช้เดิม (0012) มาเป็นรูปแรก
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shop_products' and column_name = 'usage_image') then
    update public.shop_products set usage_images = array[usage_image] where usage_image <> '' and cardinality(usage_images) = 0;
  end if;
end $$;
