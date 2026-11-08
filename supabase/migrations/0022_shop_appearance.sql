-- =============================================================
-- SysRent Shop · 0022 ฟอนต์ร้าน · เพลงในเว็บ · เอฟเฟกต์ลอย · เอฟเฟกต์รอโหลด
-- รันใน Supabase → SQL Editor หลัง 0021 (รันซ้ำได้)
-- =============================================================
alter table public.shops
  add column if not exists font text not null default '',          -- '' = ตามธีม
  add column if not exists effect text not null default 'none',
  add column if not exists loader text not null default 'none',
  add column if not exists music_url text not null default '';
