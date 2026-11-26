-- =============================================================
-- SysRent Shop · 0042 รีวิวจากผู้ซื้อจริง
--   1 รายการสินค้าที่ได้ของแล้ว = รีวิวได้ 1 ครั้ง (แก้ไขได้) · ดาว 1–5 + ข้อความ
--   ร้านซ่อนรีวิว (hidden) และตอบกลับ (reply) ได้ที่หลังบ้าน → รีวิว
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
create table if not exists public.shop_reviews (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  product_id    uuid not null references public.shop_products(id) on delete cascade,
  order_item_id uuid not null unique references public.shop_order_items(id) on delete cascade,
  customer_id   uuid not null references public.shop_customers(id) on delete cascade,
  stars         smallint not null check (stars between 1 and 5),
  body          text not null default '' check (char_length(body) <= 1000),
  hidden        boolean not null default false,
  reply         text not null default '' check (char_length(reply) <= 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists shop_reviews_product on public.shop_reviews (product_id, created_at desc) where not hidden;
create index if not exists shop_reviews_shop on public.shop_reviews (shop_id, created_at desc);
alter table public.shop_reviews enable row level security;
