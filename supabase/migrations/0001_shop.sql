-- =============================================================
-- SysRent Shop · 0001 เว็บขายแอปพรีเมียม (เช่ารายเดือน ฿299) — ฐานข้อมูลเดียวกับ SysRent
--   ทุกตารางขึ้นต้นด้วย shop_ และผูก shop_id · เปิด RLS ไม่มี policy = อ่าน/เขียนผ่านเซิร์ฟเวอร์เท่านั้น
--   ลูกค้าของแต่ละร้านเป็นบัญชีแยกของร้าน (shop_customers) ไม่ปนกับบัญชี SysRent
-- รันใน Supabase → SQL Editor ทั้งไฟล์ (รันซ้ำได้)
-- =============================================================

-- ---------- ร้าน ----------
create table if not exists public.shops (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  owner_id         uuid references auth.users(id) on delete set null,      -- เจ้าของ (บัญชี SysRent) — ค่าสลิปเกินโควตาตัดจากกระเป๋านี้
  name             text not null,
  tagline          text not null default 'แอปพรีเมียมราคาดี จ่ายแล้วได้ทันที',
  logo_url         text not null default '',
  accent           text not null default 'indigo' check (accent in ('indigo', 'pink', 'emerald', 'orange', 'sky')),
  line_url         text not null default '',
  announcement     text not null default '',
  promptpay_id     text not null default '',
  receiver_name    text not null default '',                               -- ชื่อบัญชีตามสลิป (คั่น , ได้หลายแบบ)
  admin_username   text not null default 'admin',
  admin_pass_hash  text not null default '',                               -- scrypt
  plan             text not null default 'starter' check (plan in ('starter', 'pro', 'business')),
  slip_quota       int  not null default 500,                              -- ตรวจสลิปฟรี/เดือน
  slip_overage     numeric(6,2) not null default 0.50,                     -- บาทต่อสลิปที่เกินโควตา
  notify_discord   text not null default '',
  active           boolean not null default true,
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists shops_owner_idx on public.shops (owner_id);

-- ---------- ลูกค้าของร้าน + session (ลูกค้า / แอดมินร้าน) ----------
create table if not exists public.shop_customers (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  username    text not null check (username ~ '^[a-z0-9_]{3,20}$'),
  pass_hash   text not null,
  contact     text not null default '',                                    -- LINE / เบอร์
  balance     numeric(12,2) not null default 0 check (balance >= 0),        -- กระเป๋าเงินในร้าน
  blocked     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (shop_id, username)
);
create table if not exists public.shop_sessions (
  token_hash   text primary key,                                           -- sha256 ของ cookie
  shop_id      uuid not null references public.shops(id) on delete cascade,
  customer_id  uuid references public.shop_customers(id) on delete cascade, -- null = แอดมินร้าน
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
create index if not exists shop_sessions_exp on public.shop_sessions (expires_at);
create table if not exists public.shop_login_fails (
  key          text primary key,                                           -- shop:ip หรือ shop:username
  fails        int not null default 0,
  locked_until timestamptz
);

-- ---------- สินค้า ----------
create table if not exists public.shop_products (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  name         text not null,
  category     text not null default 'ดูหนัง',
  description  text not null default '',
  image        text not null default '',
  template     text not null default '',                                   -- แม่แบบ (netflix, youtube ...) ใช้แสดงโลโก้สำรอง
  fulfillment  text not null default 'stock' check (fulfillment in ('stock', 'slot', 'manual')),
  badge        text not null default '',
  sort         int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists shop_products_shop on public.shop_products (shop_id, sort);
create table if not exists public.shop_options (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.shop_products(id) on delete cascade,
  name           text not null,
  price          numeric(10,2) not null check (price > 0),
  compare_at     numeric(10,2),
  cost           numeric(10,2),
  duration_days  int,
  sort           int not null default 0,
  active         boolean not null default true
);
create index if not exists shop_options_product on public.shop_options (product_id, sort);

-- คลังโค้ด/บัญชี (ขายแล้วส่งทันที)
create table if not exists public.shop_stock (
  id             uuid primary key default gen_random_uuid(),
  option_id      uuid not null references public.shop_options(id) on delete cascade,
  content        text not null,
  status         text not null default 'available' check (status in ('available', 'sold', 'void')),
  order_item_id  uuid,
  created_at     timestamptz not null default now(),
  sold_at        timestamptz
);
create index if not exists shop_stock_avail on public.shop_stock (option_id, created_at) where status = 'available';

-- คลังบัญชีหลัก → จอ → การเช่า (รหัสผ่านเข้ารหัส AES-GCM ฝั่งเซิร์ฟเวอร์)
create table if not exists public.shop_accounts (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  product_id  uuid not null references public.shop_products(id) on delete restrict,
  login       text not null,
  secret_enc  text not null,
  cost        numeric(10,2),
  renew_at    date,
  note        text not null default '',
  status      text not null default 'active' check (status in ('active', 'broken', 'retired')),
  created_at  timestamptz not null default now()
);
create index if not exists shop_accounts_product on public.shop_accounts (product_id, status);
create table if not exists public.shop_slots (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.shop_accounts(id) on delete cascade,
  label       text not null,
  pin         text not null default '',
  sort        int not null default 0,
  status      text not null default 'free' check (status in ('free', 'used', 'reset', 'broken'))
);
create index if not exists shop_slots_free on public.shop_slots (account_id) where status = 'free';
create table if not exists public.shop_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  customer_id    uuid not null references public.shop_customers(id) on delete cascade,
  slot_id        uuid not null references public.shop_slots(id) on delete restrict,
  product_id     uuid not null references public.shop_products(id),
  order_item_id  uuid,
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null,
  status         text not null default 'active' check (status in ('active', 'expired', 'cancelled'))
);
create unique index if not exists shop_subs_one_per_slot on public.shop_subscriptions (slot_id) where status = 'active';
create index if not exists shop_subs_customer on public.shop_subscriptions (customer_id, ends_at desc);

-- จอว่างต่อสินค้า
create or replace view public.shop_free_slots with (security_invoker = true) as
  select a.product_id, count(*)::int as free
    from public.shop_slots s join public.shop_accounts a on a.id = s.account_id
   where s.status = 'free' and a.status = 'active' group by a.product_id;
create or replace view public.shop_option_stock with (security_invoker = true) as
  select option_id, count(*)::int as available from public.shop_stock where status = 'available' group by option_id;

-- ---------- ออเดอร์ + การเงิน ----------
create table if not exists public.shop_orders (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  customer_id  uuid not null references public.shop_customers(id) on delete cascade,
  code         text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  status       text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
  total        numeric(12,2) not null check (total >= 0),
  paid_by      text check (paid_by in ('wallet', 'promptpay')),
  created_at   timestamptz not null default now(),
  paid_at      timestamptz,
  expires_at   timestamptz not null default now() + interval '30 minutes',
  unique (shop_id, code)
);
create index if not exists shop_orders_shop on public.shop_orders (shop_id, created_at desc);
create index if not exists shop_orders_customer on public.shop_orders (customer_id, created_at desc);
create table if not exists public.shop_order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.shop_orders(id) on delete cascade,
  product_id   uuid not null references public.shop_products(id),
  option_id    uuid not null references public.shop_options(id),
  name         text not null,
  qty          int not null check (qty between 1 and 20),
  unit_price   numeric(10,2) not null,
  total        numeric(12,2) not null,
  fulfillment  text not null,
  status       text not null default 'pending' check (status in ('pending', 'queued', 'delivered', 'refunded')),
  delivered    text,
  updated_at   timestamptz not null default now()
);
create index if not exists shop_items_order on public.shop_order_items (order_id);

create table if not exists public.shop_wallet_tx (
  id             bigserial primary key,
  shop_id        uuid not null references public.shops(id) on delete cascade,
  customer_id    uuid not null references public.shop_customers(id) on delete cascade,
  kind           text not null check (kind in ('topup', 'purchase', 'refund', 'adjust')),
  amount         numeric(12,2) not null,
  balance_after  numeric(12,2) not null,
  ref_id         uuid,
  note           text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists shop_wallet_tx_customer on public.shop_wallet_tx (customer_id, created_at desc);

-- QR พร้อมเพย์ (เติมกระเป๋า หรือจ่ายออเดอร์ตรง)
create table if not exists public.shop_topups (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  customer_id    uuid not null references public.shop_customers(id) on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  pay_order      uuid references public.shop_orders(id) on delete set null,
  status         text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  attempts       int not null default 0,
  last_error     text,
  trans_ref      text,
  slip           jsonb,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  paid_at        timestamptz
);
create unique index if not exists shop_topups_ref on public.shop_topups (shop_id, trans_ref) where trans_ref is not null;
create index if not exists shop_topups_shop on public.shop_topups (shop_id, created_at desc);

-- โควตาตรวจสลิปรายเดือน (เดือนตามเวลาไทย)
create table if not exists public.shop_slip_usage (
  shop_id  uuid not null references public.shops(id) on delete cascade,
  month    text not null,                                -- YYYY-MM
  used     int not null default 0,
  charged  numeric(12,2) not null default 0,              -- ค่าสลิปเกินโควตาที่ตัดจากกระเป๋าเจ้าของร้านแล้ว
  primary key (shop_id, month)
);

do $$
declare t text;
begin
  foreach t in array array['shops', 'shop_customers', 'shop_sessions', 'shop_login_fails', 'shop_products', 'shop_options', 'shop_stock',
    'shop_accounts', 'shop_slots', 'shop_subscriptions', 'shop_orders', 'shop_order_items', 'shop_wallet_tx', 'shop_topups', 'shop_slip_usage'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.shop_wallet_tx_id_seq to service_role;
grant select on public.shop_free_slots, public.shop_option_stock to service_role;

-- =============================================================
-- ฟังก์ชัน (ธุรกรรมเดียว · เรียกจากเซิร์ฟเวอร์เท่านั้น)
-- =============================================================

-- ใช้โควตาตรวจสลิป 1 ครั้ง: ในโควตา = ฟรี · เกิน = ตัดกระเป๋า SysRent ของเจ้าของร้าน · ไม่พอ = false (ห้ามตรวจ)
create or replace function public.shop_use_slip(p_shop uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare s public.shops; m text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM'); u int; bal numeric(12,2);
begin
  select * into s from public.shops where id = p_shop;
  if not found then return false; end if;
  insert into public.shop_slip_usage (shop_id, month) values (p_shop, m) on conflict do nothing;
  select used into u from public.shop_slip_usage where shop_id = p_shop and month = m for update;
  if u >= s.slip_quota then
    if s.owner_id is null or s.slip_overage <= 0 then return false; end if;
    update public.wallets set balance = balance - s.slip_overage, updated_at = now()
     where user_id = s.owner_id and balance >= s.slip_overage returning balance into bal;
    if not found then return false; end if;
    insert into public.wallet_transactions (user_id, kind, amount, balance_after, ref_id, note)
    values (s.owner_id, 'purchase', -s.slip_overage, bal, s.id, 'ค่าตรวจสลิปเกินโควตา ร้าน ' || s.slug);
    update public.shop_slip_usage set used = used + 1, charged = charged + s.slip_overage where shop_id = p_shop and month = m;
  else
    update public.shop_slip_usage set used = used + 1 where shop_id = p_shop and month = m;
  end if;
  return true;
end; $$;

-- สลิปผ่าน → เงินเข้ากระเป๋าลูกค้าในร้าน
create or replace function public.shop_credit_topup(p_topup uuid, p_ref text, p_slip jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
declare r public.shop_topups; nb numeric(12,2);
begin
  select * into r from public.shop_topups where id = p_topup for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  if exists (select 1 from public.shop_topups where shop_id = r.shop_id and trans_ref = p_ref) then raise exception 'DUPLICATE_SLIP'; end if;
  update public.shop_topups set status = 'paid', trans_ref = p_ref, slip = p_slip, paid_at = now(), last_error = null where id = r.id;
  update public.shop_customers set balance = balance + r.amount where id = r.customer_id returning balance into nb;
  insert into public.shop_wallet_tx (shop_id, customer_id, kind, amount, balance_after, ref_id, note)
  values (r.shop_id, r.customer_id, 'topup', r.amount, nb, r.id, 'เติมเงินพร้อมเพย์');
  return nb;
end; $$;

-- สร้างออเดอร์จากตะกร้า (ราคา/สต็อกจากฐานข้อมูลเท่านั้น) p_lines = [{ option_id, qty }]
create or replace function public.shop_create_order(p_shop uuid, p_customer uuid, p_lines jsonb)
returns public.shop_orders language plpgsql security definer set search_path = public as $$
declare o public.shop_orders; line jsonb; opt public.shop_options; prod public.shop_products; q int; v_total numeric(12,2) := 0;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'EMPTY_CART'; end if;
  if jsonb_array_length(p_lines) > 20 then raise exception 'CART_TOO_BIG'; end if;
  insert into public.shop_orders (shop_id, customer_id, total) values (p_shop, p_customer, 0) returning * into o;
  for line in select * from jsonb_array_elements(p_lines) loop
    select * into opt from public.shop_options where id = (line->>'option_id')::uuid and active;
    if not found then raise exception 'OPTION_UNAVAILABLE'; end if;
    select * into prod from public.shop_products where id = opt.product_id and shop_id = p_shop and active;
    if not found then raise exception 'OPTION_UNAVAILABLE'; end if;
    q := greatest(1, least(20, coalesce((line->>'qty')::int, 1)));
    if prod.fulfillment <> 'stock' and q > 1 then q := 1; end if;
    if prod.fulfillment = 'stock' and coalesce((select available from public.shop_option_stock where option_id = opt.id), 0) < q then raise exception 'OUT_OF_STOCK:%', prod.name; end if;
    if prod.fulfillment = 'slot' and coalesce((select free from public.shop_free_slots where product_id = prod.id), 0) < 1 then raise exception 'OUT_OF_STOCK:%', prod.name; end if;
    insert into public.shop_order_items (order_id, product_id, option_id, name, qty, unit_price, total, fulfillment)
    values (o.id, prod.id, opt.id, prod.name || ' · ' || opt.name, q, opt.price, opt.price * q, prod.fulfillment);
    v_total := v_total + opt.price * q;
  end loop;
  update public.shop_orders set total = v_total where id = o.id returning * into o;
  return o;
end; $$;

-- จ่ายด้วยกระเป๋า + ส่งของทันที (คลัง: หยิบโค้ด · จอ: จัดจอที่ใกล้เต็มสุด + สร้างการเช่า · สั่งทำ: รอแอดมิน)
create or replace function public.shop_pay_order(p_order uuid, p_customer uuid, p_paid_by text default 'wallet')
returns public.shop_orders language plpgsql security definer set search_path = public as $$
declare o public.shop_orders; it public.shop_order_items; bal numeric(12,2); ids uuid[]; picked text; sid uuid; slabel text; dur int; left_ int;
begin
  select * into o from public.shop_orders where id = p_order for update;
  if not found or o.customer_id <> p_customer then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  if o.expires_at < now() then update public.shop_orders set status = 'cancelled' where id = o.id; raise exception 'ORDER_EXPIRED'; end if;

  update public.shop_customers set balance = balance - o.total where id = p_customer and balance >= o.total returning balance into bal;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  insert into public.shop_wallet_tx (shop_id, customer_id, kind, amount, balance_after, ref_id, note)
  values (o.shop_id, p_customer, 'purchase', -o.total, bal, o.id, 'ซื้อสินค้า #' || o.code);

  for it in select * from public.shop_order_items where order_id = o.id for update loop
    if it.fulfillment = 'stock' then
      select array_agg(id), string_agg(content, E'\n' order by created_at) into ids, picked from (
        select id, content, created_at from public.shop_stock where option_id = it.option_id and status = 'available'
         order by created_at limit it.qty for update skip locked) s;
      if coalesce(array_length(ids, 1), 0) < it.qty then raise exception 'OUT_OF_STOCK:%', it.name; end if;
      update public.shop_stock set status = 'sold', sold_at = now(), order_item_id = it.id where id = any(ids);
      update public.shop_order_items set status = 'delivered', delivered = picked, updated_at = now() where id = it.id;
    elsif it.fulfillment = 'slot' then
      select s.id, s.label into sid, slabel from public.shop_slots s join public.shop_accounts a on a.id = s.account_id
       where a.product_id = it.product_id and a.status = 'active' and s.status = 'free'
       order by (select count(*) from public.shop_slots x where x.account_id = a.id and x.status = 'used') desc, a.created_at, s.sort
       limit 1 for update of s skip locked;
      if sid is null then raise exception 'OUT_OF_STOCK:%', it.name; end if;
      select coalesce(duration_days, 30) into dur from public.shop_options where id = it.option_id;
      update public.shop_slots set status = 'used' where id = sid;
      insert into public.shop_subscriptions (shop_id, customer_id, slot_id, product_id, order_item_id, ends_at)
      values (o.shop_id, p_customer, sid, it.product_id, it.id, now() + make_interval(days => dur));
      update public.shop_order_items set status = 'delivered', updated_at = now(),
        delivered = 'โปรไฟล์ ' || slabel || ' · ใช้ได้ ' || dur || ' วัน — ดูอีเมล / รหัส / PIN ที่หน้า "บัญชีของฉัน"' where id = it.id;
    else
      update public.shop_order_items set status = 'queued', updated_at = now() where id = it.id;
    end if;
  end loop;
  select count(*) into left_ from public.shop_order_items where order_id = o.id and status <> 'delivered';
  update public.shop_orders set status = case when left_ = 0 then 'completed' else 'processing' end,
    paid_by = case when p_paid_by = 'promptpay' then 'promptpay' else 'wallet' end, paid_at = now()
   where id = o.id returning * into o;
  return o;
end; $$;

-- หมดอายุ → จอกลับเป็น "รอเปลี่ยน PIN"
create or replace function public.shop_expire_subs()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with ended as (update public.shop_subscriptions set status = 'expired' where status = 'active' and ends_at <= now() returning slot_id)
  update public.shop_slots s set status = 'reset' from ended where s.id = ended.slot_id and s.status = 'used';
  get diagnostics n = row_count; return n;
end; $$;

do $$
declare f text;
begin
  foreach f in array array['shop_use_slip(uuid)', 'shop_credit_topup(uuid, text, jsonb)', 'shop_create_order(uuid, uuid, jsonb)',
    'shop_pay_order(uuid, uuid, text)', 'shop_expire_subs()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ---------- งานแอดมินร้าน ----------
-- ส่งของเอง (สินค้าสั่งทำ) → ครบทุกรายการ = ออเดอร์สำเร็จ
create or replace function public.shop_deliver_item(p_shop uuid, p_item uuid, p_content text)
returns boolean language plpgsql security definer set search_path = public as $$
declare it public.shop_order_items; o public.shop_orders; left_ int;
begin
  select i.* into it from public.shop_order_items i join public.shop_orders x on x.id = i.order_id where i.id = p_item and x.shop_id = p_shop;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into o from public.shop_orders where id = it.order_id for update;
  select * into it from public.shop_order_items where id = p_item for update;
  if it.status <> 'queued' then raise exception 'NOT_OPEN'; end if;
  update public.shop_order_items set status = 'delivered', delivered = left(p_content, 4000), updated_at = now() where id = it.id;
  select count(*) into left_ from public.shop_order_items where order_id = o.id and status not in ('delivered', 'refunded');
  if left_ = 0 then update public.shop_orders set status = 'completed' where id = o.id; end if;
  return true;
end; $$;

-- คืนเงินรายการที่ยังไม่ได้ส่ง เข้ากระเป๋าลูกค้าในร้าน
create or replace function public.shop_refund_item(p_shop uuid, p_item uuid, p_reason text)
returns numeric language plpgsql security definer set search_path = public as $$
declare it public.shop_order_items; o public.shop_orders; bal numeric(12,2); left_ int;
begin
  select i.* into it from public.shop_order_items i join public.shop_orders x on x.id = i.order_id where i.id = p_item and x.shop_id = p_shop;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into o from public.shop_orders where id = it.order_id for update;
  select * into it from public.shop_order_items where id = p_item for update;
  if it.status <> 'queued' or o.paid_at is null then raise exception 'NOT_OPEN'; end if;
  update public.shop_customers set balance = balance + it.total where id = o.customer_id returning balance into bal;
  insert into public.shop_wallet_tx (shop_id, customer_id, kind, amount, balance_after, ref_id, note)
  values (o.shop_id, o.customer_id, 'refund', it.total, bal, o.id, 'คืนเงิน ' || it.name || coalesce(' — ' || nullif(p_reason, ''), ''));
  update public.shop_order_items set status = 'refunded', delivered = left(p_reason, 300), updated_at = now() where id = it.id;
  select count(*) into left_ from public.shop_order_items where order_id = o.id and status not in ('delivered', 'refunded');
  if left_ = 0 then
    update public.shop_orders set status = case when exists (select 1 from public.shop_order_items where order_id = o.id and status = 'delivered') then 'completed' else 'refunded' end where id = o.id;
  end if;
  return bal;
end; $$;

-- ร้านปรับยอดกระเป๋าลูกค้า (ต้องใส่เหตุผล · ห้ามติดลบ)
create or replace function public.shop_adjust_balance(p_shop uuid, p_customer uuid, p_amount numeric, p_note text)
returns numeric language plpgsql security definer set search_path = public as $$
declare bal numeric(12,2);
begin
  if p_amount = 0 or abs(p_amount) > 100000 then raise exception 'BAD_AMOUNT'; end if;
  update public.shop_customers set balance = balance + p_amount where id = p_customer and shop_id = p_shop and balance + p_amount >= 0 returning balance into bal;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  insert into public.shop_wallet_tx (shop_id, customer_id, kind, amount, balance_after, note) values (p_shop, p_customer, 'adjust', p_amount, bal, left(p_note, 200));
  return bal;
end; $$;

do $$
declare f text;
begin
  foreach f in array array['shop_deliver_item(uuid, uuid, text)', 'shop_refund_item(uuid, uuid, text)', 'shop_adjust_balance(uuid, uuid, numeric, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- รูปสินค้า / โลโก้ร้าน (อ่านได้สาธารณะ · อัปผ่านเซิร์ฟเวอร์เท่านั้น)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-media', 'shop-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
