-- =============================================================
-- 0027 บัญชีหลักหมดอายุ: หยุดขายอัตโนมัติ และขายเฉพาะแพ็กเกจที่วันพอ
-- ใช้วันที่ในช่อง "วันหมดอายุบัญชี" (ไม่ตั้งวัน = ไม่จำกัด) — รันซ้ำได้
-- =============================================================

-- วันที่ลูกค้าใช้ครบต้องไม่เกินวันหมดอายุของบัญชี (นับตามเวลาไทย)
create or replace function public.shop_account_fits(p_renew date, p_days int)
returns boolean language sql stable as $$
  select p_renew is null or p_renew >= (now() at time zone 'Asia/Bangkok')::date + p_days;
$$;

-- จอว่างไม่นับบัญชีที่หมดอายุแล้ว
create or replace view public.shop_free_slots with (security_invoker = true) as
  select a.product_id, count(*)::int as free
    from public.shop_slots s join public.shop_accounts a on a.id = s.account_id
   where s.status = 'free' and a.status = 'active' and public.shop_account_fits(a.renew_at, 0)
   group by a.product_id;

-- ตรวจตอนสร้างออเดอร์
create or replace function public.shop_create_order(p_shop uuid, p_customer uuid, p_lines jsonb, p_coupon text default null)
returns public.shop_orders language plpgsql security definer set search_path = public as $$
declare o public.shop_orders; line jsonb; opt public.shop_options; prod public.shop_products; c public.shop_coupons;
  q int; info text; v_total numeric(12,2) := 0; disc numeric(12,2) := 0;
  ag uuid; unit numeric(12,2); used_agent boolean := false;
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
    if prod.fulfillment = 'stock' and coalesce((select available from public.shop_option_stock where option_id = opt.id), 0) < q then raise exception 'OUT_OF_STOCK:%', prod.name; end if;
    if prod.fulfillment = 'slot' and not exists (select 1 from public.shop_slots s join public.shop_accounts a on a.id = s.account_id where a.product_id = prod.id and a.status = 'active' and s.status = 'free' and public.shop_account_fits(a.renew_at, coalesce(opt.duration_days, 30))) then raise exception 'OUT_OF_STOCK:%', prod.name; end if;
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

-- จัดจอตอนจ่ายเงิน: บัญชีที่ใกล้หมดอายุก่อน เพื่อใช้จอที่เหลือให้คุ้ม
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
