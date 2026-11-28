-- =============================================================
-- SysRent Shop · 0057 เชื่อม API ร้านส่ง (ขายแอปพรีเมียมผ่าน API)
--   shop_suppliers = ร้านส่งที่ร้านกรอกเอง (URL · วิธีส่ง · หัวข้อ · รูปแบบข้อมูล · คีย์ (เข้ารหัส) · วิธีอ่านผล)
--   shop_options.supplier_id + api_code = แพ็กเกจนี้ซื้อจากร้านส่งไหน รหัสสินค้าอะไร
--   shop_order_items.api_status = กันซื้อซ้ำ (calling → ok / fail)
-- รันใน Supabase → SQL Editor หลัง 0056 (รันซ้ำได้)
-- =============================================================
create table if not exists public.shop_suppliers (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  buy_url       text not null default '' check (char_length(buy_url) <= 500),
  method        text not null default 'POST' check (method in ('POST', 'GET')),
  body_type     text not null default 'json' check (body_type in ('json', 'form')),
  headers       text not null default '' check (char_length(headers) <= 1000),
  body_tpl      text not null default '' check (char_length(body_tpl) <= 2000),
  api_key       text not null default '',
  ok_path       text not null default '' check (char_length(ok_path) <= 80),
  ok_value      text not null default '' check (char_length(ok_value) <= 80),
  account_path  text not null default '' check (char_length(account_path) <= 80),
  error_path    text not null default '' check (char_length(error_path) <= 80),
  balance_url   text not null default '' check (char_length(balance_url) <= 500),
  balance_path  text not null default '' check (char_length(balance_path) <= 80),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists shop_suppliers_shop on public.shop_suppliers (shop_id, created_at);

alter table public.shop_options add column if not exists supplier_id uuid references public.shop_suppliers(id) on delete set null;
alter table public.shop_options add column if not exists api_code text not null default '' check (char_length(api_code) <= 80);

alter table public.shop_order_items add column if not exists api_status text check (api_status in ('calling', 'ok', 'fail'));
alter table public.shop_order_items add column if not exists api_note text;

-- ประวัติการเรียก API (ดูย้อนหลัง / หาสาเหตุตอนส่งไม่สำเร็จ)
create table if not exists public.shop_supplier_logs (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  supplier_id    uuid references public.shop_suppliers(id) on delete cascade,
  order_item_id  uuid,
  kind           text not null default 'buy' check (kind in ('buy', 'test', 'balance')),
  ok             boolean not null default false,
  http           int,
  note           text not null default '',
  response       text not null default '',
  ms             int,
  created_at     timestamptz not null default now()
);
create index if not exists shop_supplier_logs_shop on public.shop_supplier_logs (shop_id, created_at desc);

alter table public.shop_suppliers enable row level security;
alter table public.shop_supplier_logs enable row level security;
grant all on public.shop_suppliers to service_role;
grant all on public.shop_supplier_logs to service_role;
