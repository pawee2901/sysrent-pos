-- =============================================================
-- SysRent Shop · 0040 พรีออเดอร์ (สินค้าส่งอัตโนมัติ)
--   ของหมด + ร้านเปิดพรีออเดอร์ → ลูกค้าจองและจ่ายได้ → รอคิว (status queued, preorder = true)
--   ร้านเติมสต็อก → shop_fill_preorders ส่งของให้ตามลำดับคนจ่ายก่อน
--   preorder_limit = รับจองได้กี่ชิ้น (null = ไม่จำกัด) · preorder_note = ข้อความบอกลูกค้า เช่น "ได้ของภายใน 1-2 วัน"
-- รันใน Supabase → SQL Editor หลัง 0036 (รันซ้ำได้)
-- =============================================================
alter table public.shop_products add column if not exists preorder boolean not null default false;
alter table public.shop_products add column if not exists preorder_note text not null default '' check (char_length(preorder_note) <= 80);
alter table public.shop_products add column if not exists preorder_limit int check (preorder_limit is null or preorder_limit > 0);
alter table public.shop_order_items add column if not exists preorder boolean not null default false;
create index if not exists shop_order_items_preorder on public.shop_order_items (option_id) where preorder and status = 'queued';

create or replace function public.shop_create_order(p_shop uuid, p_customer uuid, p_lines jsonb, p_coupon text default null)
returns public.shop_orders language plpgsql security definer set search_path = public as $$
declare o public.shop_orders; line jsonb; opt public.shop_options; prod public.shop_products; c public.shop_coupons;
  q int; info text; v_total numeric(12,2) := 0; disc numeric(12,2) := 0;
  ag uuid; unit numeric(12,2); used_agent boolean := false; pre boolean; avail int;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'EMPTY_CART'; end if;
  if jsonb_array_length(p_lines) > 20 then raise exception 'CART_TOO_BIG'; end if;
  select a.id into ag from public.shop_agents a join public.shops s on s.id = a.shop_id
   where a.shop_id = p_shop and a.customer_id = p_customer and a.active and s.plan in ('pro', 'max');
  insert into public.shop_orders (shop_id, customer_id, total) values (p_shop, p_customer, 0) returning * into o;
  for line in select * from jsonb_array_elements(p_lines) loop
    select * into opt from public.shop_options where id = (line->>'option_id')::uuid and active;
    if not found then raise exception 'OPTION_UNAVAILABLE'; end if;
    select * into prod from public.shop_products where id = opt.product_id and shop_id = p_shop and active;
    if not found then raise exception 'OPTION_UNAVAILABLE'; end if;
    q := greatest(1, least(20, coalesce((line->>'qty')::int, 1)));
    if prod.fulfillment <> 'stock' and q > 1 then q := 1; end if;
    -- ส่งอัตโนมัติ: ของหมด + ร้านเปิดพรีออเดอร์ = จองได้ (ส่งให้เองเมื่อร้านเติมสต็อก)
    pre := false;
    if prod.fulfillment = 'stock' then
      avail := coalesce((select available from public.shop_option_stock where option_id = opt.id), 0);
      if avail < q then
        if not coalesce(prod.preorder, false) then raise exception 'OUT_OF_STOCK:%', prod.name; end if;
        if prod.preorder_limit is not null and (select coalesce(sum(i.qty), 0) from public.shop_order_items i where i.product_id = prod.id and i.preorder and i.status = 'queued') + q > prod.preorder_limit then
          raise exception 'PREORDER_FULL:%', prod.name;
        end if;
        pre := true;
      end if;
    end if;
    if prod.fulfillment = 'slot' and not exists (select 1 from public.shop_slots s join public.shop_accounts a on a.id = s.account_id where a.product_id = prod.id and a.status = 'active' and s.status = 'free' and public.shop_account_fits(a.renew_at, coalesce(opt.duration_days, 30))) then raise exception 'OUT_OF_STOCK:%', prod.name; end if;
    info := left(btrim(coalesce(line->>'info', '')), 300);
    if prod.ask_info <> '' and info = '' then raise exception 'NEED_INFO:%', prod.name; end if;
    unit := opt.price;
    if ag is not null then
      select least(opt.price, agent_price) into unit from public.shop_agent_prices where option_id = opt.id;
      if unit is null then unit := opt.price; else used_agent := used_agent or unit < opt.price; end if;
    end if;
    insert into public.shop_order_items (order_id, product_id, option_id, name, qty, unit_price, total, fulfillment, customer_info, preorder)
    values (o.id, prod.id, opt.id, prod.name || ' · ' || opt.name, q, unit, unit * q, prod.fulfillment, nullif(info, ''), pre);
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
      if coalesce(array_length(ids, 1), 0) < it.qty then
        -- พรีออเดอร์ (หรือของหมดระหว่างรอจ่าย แต่ร้านเปิดพรีออเดอร์) = รอคิว · ส่งเองเมื่อเติมสต็อก
        if it.preorder or exists (select 1 from public.shop_products where id = it.product_id and preorder) then
          update public.shop_order_items set status = 'queued', preorder = true, updated_at = now() where id = it.id;
          continue;
        end if;
        raise exception 'OUT_OF_STOCK:%', it.name;
      end if;
      update public.shop_stock set status = 'sold', sold_at = now(), order_item_id = it.id where id = any(ids);
      update public.shop_order_items set status = 'delivered', delivered = picked, updated_at = now() where id = it.id;
    elsif it.fulfillment = 'slot' then
      select coalesce(duration_days, 30) into dur from public.shop_options where id = it.option_id;
      select s.id, s.label into sid, slabel from public.shop_slots s join public.shop_accounts a on a.id = s.account_id
       where a.product_id = it.product_id and a.status = 'active' and s.status = 'free' and public.shop_account_fits(a.renew_at, dur)
       order by a.renew_at asc nulls last, (select count(*) from public.shop_slots x where x.account_id = a.id and x.status = 'used') desc, a.created_at, s.sort
       limit 1 for update of s skip locked;
      if sid is null then raise exception 'OUT_OF_STOCK:%', it.name; end if;
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

-- ร้านเติมสต็อกแล้ว → ส่งของให้คิวพรีออเดอร์ของแพ็กเกจนี้ (คนจ่ายก่อนได้ก่อน) · คืนรหัสรายการที่ส่งแล้ว
create or replace function public.shop_fill_preorders(p_option uuid)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare it record; ids uuid[]; picked text; left_ int;
begin
  for it in select i.id, i.qty, i.order_id from public.shop_order_items i join public.shop_orders o on o.id = i.order_id
    where i.option_id = p_option and i.status = 'queued' and i.preorder and o.paid_at is not null
    order by o.paid_at, i.id for update of i skip locked loop
    select array_agg(id), string_agg(content, E'
' order by created_at) into ids, picked from (
      select id, content, created_at from public.shop_stock where option_id = p_option and status = 'available'
       order by created_at limit it.qty for update skip locked) s;
    if coalesce(array_length(ids, 1), 0) < it.qty then exit; end if;
    update public.shop_stock set status = 'sold', sold_at = now(), order_item_id = it.id where id = any(ids);
    update public.shop_order_items set status = 'delivered', delivered = picked, updated_at = now() where id = it.id;
    select count(*) into left_ from public.shop_order_items where order_id = it.order_id and status not in ('delivered', 'refunded');
    if left_ = 0 then update public.shop_orders set status = 'completed' where id = it.order_id; end if;
    return next it.id;
  end loop;
end; $$;
revoke all on function public.shop_fill_preorders(uuid) from public, anon, authenticated;
grant execute on function public.shop_fill_preorders(uuid) to service_role;
