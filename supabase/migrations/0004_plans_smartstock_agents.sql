-- =============================================================
-- SysRent Shop · 0004 แพ็กเกจ 4 ระดับ + Smart Stock Engine + ระบบตัวแทน (Affiliate)
-- รันใน Supabase → SQL Editor หลัง 0003 (รันซ้ำได้)
-- =============================================================

-- ---------- 1. อัปเดต plan ของร้าน ----------
-- เปลี่ยน plan check เป็น 4 ระดับใหม่
do $$
begin
  -- ลบ constraint เดิมถ้ามี
  if exists (select 1 from pg_constraint where conname = 'shops_plan_check') then
    alter table public.shops drop constraint shops_plan_check;
  end if;
  alter table public.shops add constraint shops_plan_check check (plan in ('starter', 'pro', 'growth', 'business'));
exception when others then null;
end $$;

-- จำนวนอุปกรณ์ admin ที่ล็อกอินพร้อมกันได้ (ตาม plan)
alter table public.shops add column if not exists max_admin_sessions int not null default 1;
-- โควตาคูปอง (ตาม plan)
alter table public.shops add column if not exists coupon_limit int;  -- null = ไม่จำกัด

-- ---------- 2. Smart Stock Engine ----------

-- กฎ Smart Stock ต่อร้าน
create table if not exists public.shop_smart_stock_rules (
  shop_id             uuid primary key references public.shops(id) on delete cascade,
  enabled             boolean not null default false,
  min_days_to_sell    int not null default 7,       -- ขั้นต่ำกี่วัน ถึงจะยังขายอยู่ (ต่ำกว่านี้ = หยุดขายรอรอบใหม่)
  split_thresholds    jsonb not null default '[15, 7]',  -- array ของจำนวนวันที่จะตัดแบ่งขาย เช่น [15, 7]
  price_ratio         numeric(4,2) not null default 1.0, -- ตัวคูณราคา เช่น 0.9 = ขาย 90% ของราคาตามสัดส่วนวัน
  updated_at          timestamptz not null default now()
);

-- เปิด/ปิด Smart Stock ต่อสินค้า
alter table public.shop_products add column if not exists smart_stock boolean not null default false;

-- log การตัดแบ่งอัตโนมัติ
create table if not exists public.shop_smart_stock_log (
  id             bigserial primary key,
  shop_id        uuid not null references public.shops(id) on delete cascade,
  product_id     uuid not null references public.shop_products(id) on delete cascade,
  subscription_id uuid references public.shop_subscriptions(id) on delete set null,
  action         text not null,       -- 'split', 'auto_price', 'stop_sell', 'resume'
  detail         jsonb not null default '{}',
  created_at     timestamptz not null default now()
);
create index if not exists shop_ss_log_shop on public.shop_smart_stock_log (shop_id, created_at desc);

-- ---------- 3. ระบบตัวแทน (Affiliate) ----------

-- ตัวแทนของร้าน
create table if not exists public.shop_agents (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  customer_id    uuid not null references public.shop_customers(id) on delete cascade,
  code           text not null check (code ~ '^[A-Z0-9]{3,20}$'),  -- โค้ดอ้างอิง เช่น AGENT001
  name           text not null default '',                         -- ชื่อตัวแทน
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (shop_id, code),
  unique (shop_id, customer_id)
);

-- ราคาตัวแทนต่อ option
create table if not exists public.shop_agent_prices (
  option_id      uuid not null references public.shop_options(id) on delete cascade,
  agent_price    numeric(10,2) not null check (agent_price > 0),  -- ราคาตัวแทน
  primary key (option_id)
);

-- ยอดขายตัวแทน (track ว่าออเดอร์ไหนมาจากตัวแทนคนไหน)
alter table public.shop_orders add column if not exists agent_id uuid references public.shop_agents(id) on delete set null;

-- ---------- RLS + grant ----------
do $$
declare t text;
begin
  foreach t in array array['shop_smart_stock_rules', 'shop_smart_stock_log', 'shop_agents', 'shop_agent_prices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.shop_smart_stock_log_id_seq to service_role;

-- ---------- helper views ----------

-- ดู subscription ที่ active พร้อมวันเหลือ (สำหรับ Smart Stock)
create or replace view public.shop_active_subs with (security_invoker = true) as
  select s.id, s.shop_id, s.customer_id, s.slot_id, s.product_id, s.starts_at, s.ends_at,
         greatest(0, extract(day from s.ends_at - now())::int) as days_left,
         extract(day from s.ends_at - s.starts_at)::int as total_days,
         sl.label as slot_label, a.login as account_login
    from public.shop_subscriptions s
    join public.shop_slots sl on sl.id = s.slot_id
    join public.shop_accounts a on a.id = sl.account_id
   where s.status = 'active';

grant select on public.shop_active_subs to service_role;

-- ดูยอดขายต่อตัวแทน
create or replace view public.shop_agent_sales with (security_invoker = true) as
  select a.id as agent_id, a.shop_id, a.code, a.name, a.customer_id,
         count(o.id)::int as orders, coalesce(sum(o.total), 0)::numeric(12,2) as total_sales
    from public.shop_agents a
    left join public.shop_orders o on o.agent_id = a.id and o.paid_at is not null
   group by a.id, a.shop_id, a.code, a.name, a.customer_id;

grant select on public.shop_agent_sales to service_role;
