-- =============================================================
-- 0026 ค้นหา OTP: ร้านตั้งค่าการเชื่อมเอง (Microsoft App · Token · Cloud Run)
-- ต้องรัน 0024 และ 0025 มาก่อน · รันใน Supabase → SQL Editor ทั้งไฟล์ครั้งเดียว
-- =============================================================

create table if not exists public.shop_otp_config (
  shop_id        uuid primary key references public.shops(id) on delete cascade,
  ms_client_id   text,
  ms_secret_enc  text,                       -- เข้ารหัสด้วย ENC_KEY
  updated_at     timestamptz not null default now()
);

create table if not exists public.shop_otp_apis (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('maily', 'cloud_run')),
  token_enc   text not null,                 -- Token / URL (เข้ารหัสด้วย ENC_KEY)
  created_at  timestamptz not null default now()
);
create index if not exists shop_otp_apis_shop on public.shop_otp_apis (shop_id);

alter table public.shop_otp_apps add column if not exists code text not null default '';

-- ไม่มี policy: อ่าน / เขียนผ่าน service role ฝั่งเซิร์ฟเวอร์เท่านั้น
alter table public.shop_otp_config enable row level security;
alter table public.shop_otp_apis enable row level security;
