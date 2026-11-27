-- =============================================================
-- SysRent Shop · 0045 ตรวจสลิปจ่ายตามจริง ฿0.30/สลิป (ไม่มีโควตาฟรีแล้ว)
--   ทุกสลิปที่ส่งไปตรวจ ตัด ฿0.30 จากกระเป๋า SysRent ของเจ้าของร้าน
--   กระเป๋าไม่พอ = ลูกค้าจ่ายพร้อมเพย์ไม่ได้ชั่วคราว (เหมือนเดิม)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shops alter column slip_quota set default 0;
alter table public.shops alter column slip_overage set default 0.30;
update public.shops set slip_quota = 0, slip_overage = 0.30;

-- ข้อความในประวัติกระเป๋า: "ค่าตรวจสลิป" (ไม่ใช่ "เกินโควตา" แล้ว)
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
    values (s.owner_id, 'purchase', -s.slip_overage, bal, s.id, 'ค่าตรวจสลิป ร้าน ' || s.slug);
    update public.shop_slip_usage set used = used + 1, charged = charged + s.slip_overage where shop_id = p_shop and month = m;
  else
    update public.shop_slip_usage set used = used + 1 where shop_id = p_shop and month = m;
  end if;
  return true;
end; $$;
revoke all on function public.shop_use_slip(uuid) from public, anon, authenticated;
grant execute on function public.shop_use_slip(uuid) to service_role;
