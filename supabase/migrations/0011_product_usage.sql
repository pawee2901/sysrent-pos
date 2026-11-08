-- =============================================================
-- SysRent Shop · 0011 วิธีการใช้งานของสินค้า (ลูกค้าเห็นพร้อมรหัสหลังซื้อ)
-- รันใน Supabase → SQL Editor หลัง 0010 (รันซ้ำได้)
-- =============================================================
alter table public.shop_products add column if not exists usage text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_products_usage_len') then
    alter table public.shop_products add constraint shop_products_usage_len check (char_length(usage) <= 3000);
  end if;
end $$;
