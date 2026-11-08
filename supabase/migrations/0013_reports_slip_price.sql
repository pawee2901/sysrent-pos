-- =============================================================
-- SysRent Shop · 0013 ลูกค้าแจ้งปัญหาออเดอร์ (แพ็กเกจ ฿399 ขึ้นไป) + ค่าตรวจสลิปเกินโควตา ฿0.45
-- รันใน Supabase → SQL Editor หลัง 0012 (รันซ้ำได้)
-- =============================================================

-- ตรวจสลิปฟรี 100 ครั้ง/เดือน · เกินคิดครั้งละ ฿0.45 (ตัดกระเป๋า SysRent ของเจ้าของร้าน)
alter table public.shops alter column slip_overage set default 0.45;
update public.shops set slip_overage = 0.45 where slip_overage = 0.5;

-- เรื่องที่ลูกค้าแจ้ง
create table if not exists public.shop_reports (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  customer_id  uuid not null references public.shop_customers(id) on delete cascade,
  order_id     uuid not null references public.shop_orders(id) on delete cascade,
  topic        text not null check (char_length(topic) between 1 and 60),
  message      text not null default '' check (char_length(message) <= 1000),
  status       text not null default 'open' check (status in ('open', 'resolved')),
  reply        text not null default '' check (char_length(reply) <= 1000),   -- ร้านตอบกลับ (ลูกค้าเห็นในหน้าประวัติ)
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists shop_reports_shop on public.shop_reports (shop_id, status, created_at desc);
create index if not exists shop_reports_order on public.shop_reports (order_id);
alter table public.shop_reports enable row level security;
grant all on public.shop_reports to service_role;

-- แจ้งเตือน Discord เรื่องแจ้งปัญหา (เพิ่มให้ร้านที่ตั้งค่าไว้แล้ว)
update public.shops set discord_events = array_append(discord_events, 'report') where not ('report' = any(discord_events));
alter table public.shops alter column discord_events set default '{order,manual,topup,stock,signup,report}';
