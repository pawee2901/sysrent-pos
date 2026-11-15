-- =============================================================
-- SysRent Shop · 0034 จัดหน้าแรกเอง
--   shops.home_layout = รายการกล่องบนหน้าแรก เรียงจากบนลงล่าง (null = หน้าแรกแบบเดิม)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shops add column if not exists home_layout jsonb;
