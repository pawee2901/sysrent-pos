-- =============================================================
-- SysRent Shop · 0039 เลือกเหตุการณ์ที่แจ้งลูกค้าในแอปร้าน
--   shops.push_events = เหตุการณ์ที่เปิดไว้ (paid · deliver · refund · report · topup)
-- รันใน Supabase → SQL Editor หลัง 0038 (รันซ้ำได้)
-- =============================================================
alter table public.shops add column if not exists push_events text[] not null default array['paid', 'deliver', 'refund', 'report', 'topup'];
