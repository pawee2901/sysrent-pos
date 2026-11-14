-- =============================================================
-- 0029 ขายสินค้าใน LINE OA ของร้าน (แพ็กเกจ Pro / Max · ต้องรัน 0028 ก่อน) — รันซ้ำได้
--
-- ลูกค้าใน LINE ไม่ต้องสมัคร: ครั้งแรกที่กดปุ่ม ระบบสร้างบัญชีลูกค้าร้านเบื้องหลังให้ (shop_customers.line_user_id)
-- ออเดอร์ / สต็อก / จอ / คูปอง / บัญชี ใช้ชุดเดียวกับหน้าเว็บร้านทั้งหมด
-- =============================================================

alter table public.shop_customers add column if not exists line_user_id text;
create unique index if not exists shop_customers_line on public.shop_customers (shop_id, line_user_id) where line_user_id is not null;

-- ตะกร้า + ขั้นตอนที่ค้างในแชท (เช่น รอให้พิมพ์ข้อมูลที่ร้านขอ)
create table if not exists public.shop_line_sessions (
  shop_id       uuid not null references public.shops(id) on delete cascade,
  line_user_id  text not null,
  customer_id   uuid not null references public.shop_customers(id) on delete cascade,
  cart          jsonb not null default '[]'::jsonb,     -- [{ "option_id": "...", "qty": 1, "info": "" }]
  awaiting      jsonb,                                  -- { "option_id": "...", "since": "..." }
  handoff_at    timestamptz,                            -- กด "คุยกับแอดมิน" ล่าสุด (กันแจ้งรัว ๆ)
  updated_at    timestamptz not null default now(),
  primary key (shop_id, line_user_id)
);
alter table public.shop_line_sessions enable row level security;

-- ร้านเปิด / ปิดการขายใน LINE เองได้ (เปิดอยู่ = ลูกค้าพิมพ์ "ดูสินค้า" แล้วสั่งได้)
alter table public.shops add column if not exists line_shop boolean not null default true;
