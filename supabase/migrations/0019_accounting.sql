-- =============================================================
-- SysRent Shop · 0019 ระบบบัญชี (รายรับ · ต้นทุน · กำไร · รายจ่าย)
--   unit_cost = ต้นทุนต่อชิ้น "ตอนขาย" (จำค่าไว้ · แก้ต้นทุนสินค้าทีหลัง กำไรของเดือนเก่าไม่เปลี่ยน)
--   shop_expenses = รายจ่ายอื่นที่ร้านจดเอง (ค่าซื้อบัญชี · ค่าโฆษณา · ค่าเช่าร้าน ฯลฯ)
-- รันใน Supabase → SQL Editor หลัง 0018 (รันซ้ำได้)
-- =============================================================

-- ต้นทุนตอนขาย: ทุกรายการที่สร้างใหม่ดึงจากต้นทุนของแพ็กเกจตอนนั้นเอง
alter table public.shop_order_items add column if not exists unit_cost numeric(12,2);
update public.shop_order_items i set unit_cost = o.cost
  from public.shop_options o where o.id = i.option_id and i.unit_cost is null and o.cost is not null;

create or replace function public.shop_item_cost() returns trigger language plpgsql as $$
begin
  if new.unit_cost is null then
    select cost into new.unit_cost from public.shop_options where id = new.option_id;
  end if;
  return new;
end; $$;
drop trigger if exists shop_order_items_cost on public.shop_order_items;
create trigger shop_order_items_cost before insert on public.shop_order_items
  for each row execute function public.shop_item_cost();

-- รายจ่ายอื่น
create table if not exists public.shop_expenses (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  spent_on    date not null default ((now() at time zone 'Asia/Bangkok')::date),
  category    text not null check (char_length(category) between 1 and 40),
  note        text not null default '' check (char_length(note) <= 200),
  amount      numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  created_at  timestamptz not null default now()
);
create index if not exists shop_expenses_shop on public.shop_expenses (shop_id, spent_on desc);
alter table public.shop_expenses enable row level security;
grant all on public.shop_expenses to service_role;
