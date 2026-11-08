-- =============================================================
-- SysRent Shop · 0014 เหลือ 2 แพ็กเกจ: starter (ปกติ ฿299) · pro (Pro ฿399)
--   ร้านที่เคยตั้งเป็น growth / business → pro (ได้ฟีเจอร์ครบเหมือนเดิม)
-- รันใน Supabase → SQL Editor หลัง 0013 (รันซ้ำได้)
-- =============================================================
update public.shops set plan = 'pro' where plan in ('growth', 'business');
update public.shops set plan = 'starter' where plan not in ('starter', 'pro');

alter table public.shops drop constraint if exists shops_plan_check;
alter table public.shops add constraint shops_plan_check check (plan in ('starter', 'pro'));
alter table public.shops alter column plan set default 'starter';
