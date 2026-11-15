-- =============================================================
-- SysRent Shop · 0035 หน้าเพิ่มเติมของร้าน (จัดกล่องแบบลากวางเหมือนหน้าแรก)
--   ลิงก์หน้าร้าน: /s/<slug> · in_menu = โชว์ในเมนูด้านบนของร้าน
-- รันใน Supabase → SQL Editor หลัง 0034 (รันซ้ำได้)
-- =============================================================
create table if not exists public.shop_pages (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  slug       text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  title      text not null default '' check (char_length(title) <= 60),
  blocks     jsonb not null default '[]'::jsonb,
  in_menu    boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, slug)
);
create index if not exists shop_pages_shop on public.shop_pages (shop_id, sort);
alter table public.shop_pages enable row level security;
