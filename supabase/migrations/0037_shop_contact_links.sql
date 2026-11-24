-- =============================================================
-- SysRent Shop · 0037 ช่องทางติดต่อร้านแบบหลายลิงก์
--   shops.contact_links = [{ kind, url, label, note }] (ปุ่มลอย "ติดต่อเรา" + ท้ายเว็บ)
--   ร้านเดิม: ย้าย LINE / Facebook ที่ใส่ไว้มาเป็นรายการแรกให้ (เฉพาะร้านที่ยังไม่มีรายการ)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shops add column if not exists contact_links jsonb not null default '[]'::jsonb;

update public.shops s set contact_links = (
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (values
    (case when coalesce(s.line_url, '') <> '' then jsonb_build_object('kind', 'line', 'url', s.line_url, 'label', '', 'note', '') end),
    (case when coalesce(s.facebook_url, '') <> '' then jsonb_build_object('kind', 'facebook', 'url', s.facebook_url, 'label', '', 'note', '') end)
  ) v(x) where x is not null)
where s.contact_links = '[]'::jsonb;
