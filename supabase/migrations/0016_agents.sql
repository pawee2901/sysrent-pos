-- =============================================================
-- SysRent Shop · 0016 ระบบตัวแทน (ซื้อราคาส่ง) — เฉพาะร้านแพ็กเกจ Pro
--   ร้านตั้งลูกค้าเป็นตัวแทน → ตัวแทนเห็น/ซื้อในราคาตัวแทนที่ร้านตั้งต่อแพ็กเกจ (ไม่ตั้ง = ราคาปกติ)
--   ราคาคิดในฐานข้อมูล (shop_create_order) ลูกค้าแก้ราคาจากหน้าเว็บไม่ได้
--   โครงตารางเหมือน 0004 (ไม่ต้องรัน 0004 · รันไฟล์นี้แทนได้เลย)
-- รันใน Supabase → SQL Editor หลัง 0015 (รันซ้ำได้)
-- =============================================================

create table if not exists public.shop_agents (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  customer_id  uuid not null references public.shop_customers(id) on delete cascade,
  code         text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  name         text not null default '',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (shop_id, code),
  unique (shop_id, customer_id)
);

-- ราคาตัวแทนต่อแพ็กเกจ (ไม่มีแถว = ตัวแทนซื้อราคาปกติ)
create table if not exists public.shop_agent_prices (
  option_id    uuid primary key references public.shop_options(id) on delete cascade,
  agent_price  numeric(10,2) not null check (agent_price > 0)
);

-- ออเดอร์นี้ตัวแทนซื้อในราคาตัวแทน
alter table public.shop_orders add column if not exists agent_id uuid references public.shop_agents(id) on delete set null;
create index if not exists shop_orders_agent on public.shop_orders (agent_id) where agent_id is not null;

do $$
declare t text;
begin
  foreach t in array array['shop_agents', 'shop_agent_prices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- สร้างออเดอร์ (เหมือน 0002) + ราคาตัวแทน: ร้าน Pro + ลูกค้าเป็นตัวแทนที่เปิดอยู่ + แพ็กเกจมีราคาตัวแทน
create or replace function public.shop_create_order(p_shop uuid, p_customer uuid, p_lines jsonb, p_coupon text default null)
returns public.shop_orders language plpgsql security definer set search_path = public as $$
declare o public.shop_orders; line jsonb; opt public.shop_options; prod public.shop_products; c public.shop_coupons;
  q int; info text; v_total numeric(12,2) := 0; disc numeric(12,2) := 0;
  ag uuid; unit numeric(12,2); used_agent boolean := false;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'EMPTY_CART'; end if;
  if jsonb_array_length(p_lines) > 20 then raise exception 'CART_TOO_BIG'; end if;
  select a.id into ag from public.shop_agents a join public.shops s on s.id = a.shop_id
   where a.shop_id = p_shop and a.customer_id = p_customer and a.active and s.plan = 'pro';
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
    info := left(btrim(coalesce(line->>'info', '')), 300);
    if prod.ask_info <> '' and info = '' then raise exception 'NEED_INFO:%', prod.name; end if;
    unit := opt.price;
    if ag is not null then
      select least(opt.price, agent_price) into unit from public.shop_agent_prices where option_id = opt.id;
      if unit is null then unit := opt.price; else used_agent := used_agent or unit < opt.price; end if;
    end if;
    insert into public.shop_order_items (order_id, product_id, option_id, name, qty, unit_price, total, fulfillment, customer_info)
    values (o.id, prod.id, opt.id, prod.name || ' · ' || opt.name, q, unit, unit * q, prod.fulfillment, nullif(info, ''));
    v_total := v_total + unit * q;
  end loop;

  if nullif(btrim(coalesce(p_coupon, '')), '') is not null then
    select * into c from public.shop_coupons where shop_id = p_shop and code = upper(btrim(p_coupon)) and active;
    if not found or (c.expires_at is not null and c.expires_at < now()) then raise exception 'COUPON_INVALID'; end if;
    if c.max_uses is not null and c.used >= c.max_uses then raise exception 'COUPON_USED_UP'; end if;
    if v_total < c.min_total then raise exception 'COUPON_MIN:%', c.min_total; end if;
    if exists (select 1 from public.shop_orders where customer_id = p_customer and coupon_id = c.id and paid_at is not null) then raise exception 'COUPON_ALREADY_USED'; end if;
    disc := case when c.kind = 'percent' then round(v_total * c.value / 100, 2) else c.value end;
    if c.max_discount is not null then disc := least(disc, c.max_discount); end if;
    disc := least(disc, v_total);
  end if;

  update public.shop_orders set subtotal = v_total, discount = disc, total = v_total - disc, coupon_id = c.id,
    agent_id = case when used_agent then ag else null end
   where id = o.id returning * into o;
  return o;
end; $$;
revoke all on function public.shop_create_order(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.shop_create_order(uuid, uuid, jsonb, text) to service_role;
