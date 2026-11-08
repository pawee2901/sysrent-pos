-- =============================================================
-- SysRent Shop · 0003 พื้นหลังหน้าร้าน (แบบสำเร็จรูป หรืออัปรูปเอง)
-- รันใน Supabase → SQL Editor หลัง 0002 (รันซ้ำได้)
-- =============================================================
alter table public.shops
  add column if not exists bg_style text not null default 'default',
  add column if not exists bg_image text not null default '';               -- ใช้เมื่อ bg_style = 'image'

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shops_bg_style_check') then
    alter table public.shops add constraint shops_bg_style_check check (bg_style in ('default', 'plain', 'aurora', 'dots', 'image'));
  end if;
end $$;
