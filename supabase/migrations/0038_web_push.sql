-- =============================================================
-- SysRent Shop · 0038 แอปร้าน + แจ้งเตือนลูกค้า (Web Push)
--   app_push_keys   = กุญแจ VAPID ของเซิร์ฟเวอร์ (แถวเดียว · ระบบสร้างเองครั้งแรก)
--   shop_push_subs  = เครื่องของลูกค้าที่เปิดรับแจ้งเตือน (1 ลูกค้ามีได้หลายเครื่อง)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
create table if not exists public.app_push_keys (
  id          int primary key default 1 check (id = 1),
  public_key  text not null,
  private_jwk jsonb not null,
  created_at  timestamptz not null default now()
);
alter table public.app_push_keys enable row level security;

create table if not exists public.shop_push_subs (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.shop_customers(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists shop_push_subs_customer on public.shop_push_subs (shop_id, customer_id);
alter table public.shop_push_subs enable row level security;
