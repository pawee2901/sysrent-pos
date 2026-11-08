-- =============================================================
-- SysRent Shop · 0005 ธีมหน้าร้าน
--   theme        = ธีมที่ใช้อยู่ (ร้านเปลี่ยนเองในหลังบ้าน)
--   themes_owned = ธีมพิเศษที่ร้านซื้อจาก sysrent.shop แล้ว (SysRent ปลดล็อกผ่าน API ภายใน) — ธีมฟรีไม่ต้องอยู่ในนี้
-- รันใน Supabase → SQL Editor หลัง 0004 (รันซ้ำได้)
-- =============================================================
alter table public.shops
  add column if not exists theme        text   not null default 'modern',
  add column if not exists themes_owned text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shops_theme_check') then
    alter table public.shops add constraint shops_theme_check check (theme ~ '^[a-z0-9-]{2,20}$');
  end if;
end $$;
