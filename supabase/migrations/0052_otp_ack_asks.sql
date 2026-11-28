-- =============================================================
-- SysRent Shop · 0052 ป๊อปอัปก่อนขอ OTP (แก้ข้อความ / เปิด-ปิด) + คำขอ OTP เพิ่ม
--   shop_otp_config.ack_on   = แสดงป๊อปอัปให้ลูกค้าติ๊กยอมรับไหม (ปิด = ยังจำกัดจำนวนครั้ง แต่ไม่ถาม)
--   shop_otp_config.ack_text = ข้อความในป๊อปอัป ('' = ข้อความมาตรฐาน) · ใส่ {limit} {left} ได้
--   shop_otp_asks = ลูกค้าขอครบแล้ว กดขอเพิ่ม + เขียนเหตุผล → แอดมินอนุมัติ (+ จำนวนครั้ง) / ปฏิเสธ
--   ต้องรัน 0051 มาก่อน · ยังไม่รันไฟล์นี้ = ป๊อปอัปแบบมาตรฐาน · ยังขอเพิ่มไม่ได้
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_otp_config add column if not exists ack_on boolean not null default true;
alter table public.shop_otp_config add column if not exists ack_text text not null default '';
alter table public.shop_otp_config drop constraint if exists shop_otp_config_ack_len;
alter table public.shop_otp_config add constraint shop_otp_config_ack_len check (char_length(ack_text) <= 1000);

create table if not exists public.shop_otp_asks (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  order_item_id  uuid not null references public.shop_order_items(id) on delete cascade,
  customer_id    uuid references public.shop_customers(id) on delete set null,
  account        text not null check (char_length(account) <= 120),
  note           text not null default '' check (char_length(note) <= 500),
  status         text not null default 'open' check (status in ('open', 'approved', 'rejected')),
  extra          int  not null default 0 check (extra between 0 and 20),
  reply          text not null default '' check (char_length(reply) <= 500),
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);
create index if not exists shop_otp_asks_shop on public.shop_otp_asks (shop_id, status, created_at desc);
create index if not exists shop_otp_asks_item on public.shop_otp_asks (order_item_id, status);
alter table public.shop_otp_asks enable row level security; -- ไม่มี policy: ผ่าน service role เท่านั้น
