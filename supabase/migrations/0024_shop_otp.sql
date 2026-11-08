-- =============================================================
-- 0024 ค้นหา OTP (แพ็กเกจ Max)
-- รันใน Supabase → SQL Editor ทั้งไฟล์ครั้งเดียว
-- =============================================================

create table if not exists public.shop_otp_mailboxes (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  email       text not null,
  provider    text not null check (provider in ('gmail', 'maily')),
  secret_enc  text not null,                 -- App Password / Token / PIN (เข้ารหัสด้วย ENC_KEY)
  active      boolean not null default true,
  last_error  text,
  created_at  timestamptz not null default now()
);
create unique index if not exists shop_otp_mailboxes_email on public.shop_otp_mailboxes (shop_id, lower(email));

create table if not exists public.shop_otp_apps (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null,
  keywords    text not null,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists shop_otp_apps_name on public.shop_otp_apps (shop_id, lower(name));

create table if not exists public.shop_otp_requests (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  customer_id  uuid not null references public.shop_customers(id) on delete cascade,
  account      text not null,
  app          text not null,
  found        boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists shop_otp_requests_limit on public.shop_otp_requests (customer_id, created_at desc);
create index if not exists shop_otp_requests_shop on public.shop_otp_requests (shop_id, created_at desc);

-- ไม่มี policy: อ่าน / เขียนผ่าน service role ฝั่งเซิร์ฟเวอร์เท่านั้น
alter table public.shop_otp_mailboxes enable row level security;
alter table public.shop_otp_apps enable row level security;
alter table public.shop_otp_requests enable row level security;
