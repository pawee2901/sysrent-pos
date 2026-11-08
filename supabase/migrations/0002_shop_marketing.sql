-- =============================================================
-- SysRent Shop · 0002 การตลาดหน้าร้าน + คูปอง + ข้อมูลจากลูกค้า
--   แบนเนอร์ / ป๊อปอัป / ลิงก์ Facebook · คูปองส่วนลด (% หรือบาท) · สินค้าที่ต้องถามข้อมูลลูกค้า (เช่น อีเมลเชิญเข้าครอบครัว)
-- รันใน Supabase → SQL Editor ทั้งไฟล์ หลัง 0001 (รันซ้ำได้)
-- =============================================================

-- ---------- หน้าร้าน ----------
alter table public.shops
  add column if not exists facebook_url text not null default '',
  add column if not exists banner_url   text not null default '',          -- รูปแบนเนอร์ใต้หัวเว็บหน้าแรก (ว่าง = ไม่แสดง)
  add column if not exists banner_link  text not null default '',
  add column if not exists popup_text   text not null default '',          -- ป๊อปอัปตอนเข้าเว็บ (ข้อความ / รูป ว่างทั้งคู่ = ไม่แสดง)
  add column if not exists popup_image  text not null default '',
  add column if not exists popup_link   text not null default '';

-- ---------- ข้อมูลที่ร้านขอจากลูกค้าตอนสั่ง ----------
alter table public.shop_products add column if not exists ask_info text not null default '';   -- หัวข้อที่ถาม (ว่าง = ไม่ถาม)
alter table public.shop_order_items add column if not exists customer_info text;

-- ---------- คูปอง ----------
create table if not exists public.shop_coupons (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  code          text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  kind          text not null check (kind in ('percent', 'amount')),
  value         numeric(10,2) not null check (value > 0),
  min_total     numeric(10,2) not null default 0,
  max_discount  numeric(10,2),                                             -- เพดานส่วนลด (ใช้กับแบบ %)
  max_uses      int check (max_uses > 0),                                  -- null = ไม่จำกัด
  used          int not null default 0,                                    -- นับตอนจ่ายเงินสำเร็จ
  expires_at    timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (shop_id, code),
  check (kind <> 'percent' or value <= 100)
);
alter table public.shop_coupons enable row level security;
grant all on public.shop_coupons to service_role;

alter table public.shop_orders
  add column if not exists subtotal  numeric(12,2),                         -- ราคาก่อนลด (ออเดอร์เก่า = null → ใช้ total)
  add column if not exists discount  numeric(12,2) not null default 0,
  add column if not exists coupon_id uuid references public.shop_coupons(id) on delete set null;

-- =============================================================
-- ฟังก์ชัน (แทนของ 0001)
-- =============================================================

-- สร้างออเดอร์: p_lines = [{ option_id, qty, info }] · p_coupon = โค้ดส่วนลด (ไม่บังคับ)
drop function if exists public.shop_create_order(uuid, uuid, jsonb);
create or replace function public.shop_create_order(p_shop uuid, p_customer uuid, p_lines jsonb, p_coupon text default null)
returns public.shop_orders language plpgsql security definer set search_path = public as $$
declare o public.shop_orders; line jsonb; opt public.shop_options; prod public.shop_products; c public.shop_coupons;
  q int; info text; v_total numeric(12,2) := 0; disc numeric(12,2) := 0;
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
    info := left(btrim(coalesce(line->>'info', '')), 300);
    if prod.ask_info <> '' and info = '' then raise exception 'NEED_INFO:%', prod.name; end if;
    insert into public.shop_order_items (order_id, product_id, option_id, name, qty, unit_price, total, fulfillment, customer_info)
    values (o.id, prod.id, opt.id, prod.name || ' · ' || opt.name, q, opt.price, opt.price * q, prod.fulfillment, nullif(info, ''));
    v_total := v_total + opt.price * q;
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

  update public.shop_orders set subtotal = v_total, discount = disc, total = v_total - disc, coupon_id = c.id where id = o.id returning * into o;
  return o;
end; $$;

-- จ่ายออเดอร์ (เหมือน 0001 + นับการใช้คูปองตอนจ่ายสำเร็จ — ออเดอร์ที่ไม่จ่ายไม่กินสิทธิ์)
create or replace function public.shop_pay_order(p_order uuid, p_customer uuid, p_paid_by text default 'wallet')
returns public.shop_orders language plpgsql security definer set search_path = public as $$
declare o public.shop_orders; it public.shop_order_items; bal numeric(12,2); ids uuid[]; picked text; sid uuid; slabel text; dur int; left_ int;
begin
  select * into o from public.shop_orders where id = p_order for update;
  if not found or o.customer_id <> p_customer then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  if o.expires_at < now() then update public.shop_orders set status = 'cancelled' where id = o.id; raise exception 'ORDER_EXPIRED'; end if;

  if o.coupon_id is not null then
    update public.shop_coupons set used = used + 1 where id = o.coupon_id and active and (max_uses is null or used < max_uses);
    if not found then raise exception 'COUPON_USED_UP'; end if;
    if exists (select 1 from public.shop_orders where customer_id = p_customer and coupon_id = o.coupon_id and paid_at is not null and id <> o.id) then raise exception 'COUPON_ALREADY_USED'; end if;
  end if;

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

-- คืนเงินรายการที่ยังไม่ได้ส่ง: ออเดอร์ที่ใช้คูปอง คืนตามสัดส่วนที่จ่ายจริง
create or replace function public.shop_refund_item(p_shop uuid, p_item uuid, p_reason text)
returns numeric language plpgsql security definer set search_path = public as $$
declare it public.shop_order_items; o public.shop_orders; bal numeric(12,2); amt numeric(12,2); left_ int;
begin
  select i.* into it from public.shop_order_items i join public.shop_orders x on x.id = i.order_id where i.id = p_item and x.shop_id = p_shop;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into o from public.shop_orders where id = it.order_id for update;
  select * into it from public.shop_order_items where id = p_item for update;
  if it.status <> 'queued' or o.paid_at is null then raise exception 'NOT_OPEN'; end if;
  amt := case when coalesce(o.subtotal, 0) > 0 then round(it.total * o.total / o.subtotal, 2) else it.total end;
  update public.shop_customers set balance = balance + amt where id = o.customer_id returning balance into bal;
  insert into public.shop_wallet_tx (shop_id, customer_id, kind, amount, balance_after, ref_id, note)
  values (o.shop_id, o.customer_id, 'refund', amt, bal, o.id, 'คืนเงิน ' || it.name || coalesce(' — ' || nullif(p_reason, ''), ''));
  update public.shop_order_items set status = 'refunded', delivered = left(p_reason, 300), updated_at = now() where id = it.id;
  select count(*) into left_ from public.shop_order_items where order_id = o.id and status not in ('delivered', 'refunded');
  if left_ = 0 then
    update public.shop_orders set status = case when exists (select 1 from public.shop_order_items where order_id = o.id and status = 'delivered') then 'completed' else 'refunded' end where id = o.id;
  end if;
  return bal;
end; $$;

do $$
declare f text;
begin
  foreach f in array array['shop_create_order(uuid, uuid, jsonb, text)', 'shop_pay_order(uuid, uuid, text)', 'shop_refund_item(uuid, uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
