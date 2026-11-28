-- =============================================================
-- SysRent Shop · 0058 สมุดบัญชี (บัญชีเงินหลายบัญชี · รายรับ / รายจ่าย / โอนระหว่างบัญชี)
--   shop_money_accounts = บัญชีเงินของร้าน (ธนาคาร · เงินสด · วอลเล็ต) + ยอดตั้งต้น
--     is_sales = บัญชีที่รับเงินขาย (ยอดขายจากออเดอร์นับเข้าบัญชีนี้อัตโนมัติ)
--   shop_ledger = รายการที่จดเอง (in = รายรับ · out = รายจ่าย · transfer = โอนจาก account_id ไป to_account)
--   ย้ายรายจ่ายเดิม (shop_expenses) เข้าสมุดบัญชีให้ (id เดิม · รันซ้ำไม่ซ้ำ)
-- รันใน Supabase → SQL Editor หลัง 0057 (รันซ้ำได้)
-- =============================================================
create table if not exists public.shop_money_accounts (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  kind        text not null default 'bank' check (kind in ('bank', 'cash', 'wallet', 'other')),
  number      text not null default '' check (char_length(number) <= 40),
  opening     numeric(14,2) not null default 0,
  is_sales    boolean not null default false,
  sort        int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists shop_money_accounts_shop on public.shop_money_accounts (shop_id, sort);

create table if not exists public.shop_ledger (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  kind        text not null check (kind in ('in', 'out', 'transfer')),
  on_date     date not null default ((now() at time zone 'Asia/Bangkok')::date),
  category    text not null default '' check (char_length(category) <= 40),
  note        text not null default '' check (char_length(note) <= 200),
  amount      numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  account_id  uuid references public.shop_money_accounts(id) on delete set null,
  to_account  uuid references public.shop_money_accounts(id) on delete set null,
  ref         text not null default '' check (char_length(ref) <= 40),
  created_at  timestamptz not null default now()
);
create index if not exists shop_ledger_shop on public.shop_ledger (shop_id, on_date desc);

-- รายจ่ายเดิม → สมุดบัญชี
insert into public.shop_ledger (id, shop_id, kind, on_date, category, note, amount, created_at)
select e.id, e.shop_id, 'out', e.spent_on, e.category, e.note, e.amount, e.created_at
  from public.shop_expenses e
 where not exists (select 1 from public.shop_ledger l where l.id = e.id);

alter table public.shop_money_accounts enable row level security;
alter table public.shop_ledger enable row level security;
grant all on public.shop_money_accounts to service_role;
grant all on public.shop_ledger to service_role;
