-- =============================================================
-- SysRent Shop · 0017 ยศลูกค้า: ลูกค้าทั่วไป · ตัวแทน · แอดมิน
--   role = 'admin' → ล็อกอินด้วยบัญชีลูกค้าของตัวเองแล้วเข้าหลังบ้านร้านได้ (เช่น พนักงาน)
--   ตัวแทน = มีแถวใน shop_agents (0016) · ยศอื่นใช้ role = 'customer'
-- รันใน Supabase → SQL Editor หลัง 0016 (รันซ้ำได้)
-- =============================================================
alter table public.shop_customers add column if not exists role text not null default 'customer';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_customers_role_check') then
    alter table public.shop_customers add constraint shop_customers_role_check check (role in ('customer', 'admin'));
  end if;
end $$;
