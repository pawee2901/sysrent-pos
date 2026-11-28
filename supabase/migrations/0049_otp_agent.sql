-- =============================================================
-- SysRent Shop · 0049 หน้ารับ OTP: ระบบตัวแทน (แบบเว็บเช่า OTP)
--   ร้านเปิด "ระบบตัวแทน" → ลูกค้า / ตัวแทน ต้องกรอกอีเมล + รหัสยืนยันที่ร้านให้ ถึงจะได้ OTP
--   รหัสยืนยัน 1 แถว = 1 รหัส: รหัส 4 หลัก / ชื่อยูส / อีเมลตัวแทน · หลายแถวต่ออีเมล = แยกจอ (แต่ละจอมีรหัสและโควตาของตัวเอง)
--   use_limit = รับรหัสได้กี่ครั้งต่อ period (0 = ไม่จำกัด)
--   ต้องรัน 0048 มาก่อน · ยังไม่รันไฟล์นี้ = ใช้ระบบตัวแทนไม่ได้ (หน้ารับ OTP แบบปกติใช้ได้ตามเดิม)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_otp_config add column if not exists agent_mode boolean not null default false;

create table if not exists public.shop_otp_access (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  email       text not null check (char_length(email) <= 120),
  label       text not null default '' check (char_length(label) <= 40),
  kind        text not null default 'pin' check (kind in ('pin', 'username', 'email')),
  secret      text not null check (char_length(secret) between 1 and 120),
  use_limit   int  not null default 0 check (use_limit between 0 and 1000),
  period      text not null default 'day' check (period in ('day', 'week', 'month')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists shop_otp_access_email on public.shop_otp_access (shop_id, email);
create unique index if not exists shop_otp_access_one on public.shop_otp_access (shop_id, email, kind, secret);
alter table public.shop_otp_access enable row level security; -- ไม่มี policy: ผ่าน service role เท่านั้น

-- นับโควตาต่อรหัส
alter table public.shop_otp_requests add column if not exists access_id uuid references public.shop_otp_access(id) on delete set null;
create index if not exists shop_otp_requests_access on public.shop_otp_requests (access_id, created_at desc) where access_id is not null;
