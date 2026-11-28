-- =============================================================
-- SysRent Shop · 0056 ออกแบบทั้งร้าน (จากหน้าจัดหน้าร้าน)
--   shops.palette = โทนสีทั้งร้าน { accent, accent2, bg, surface, text } ('{}' = ตามธีม)
--   shops.site_frame = หัวเว็บ / ท้ายเว็บ { logo: left|center, search, footer, footerLinks, tabbar }
--   ยังไม่รันไฟล์นี้ = ร้านใช้สีตามธีม / หัวเว็บท้ายเว็บแบบเดิม
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shops add column if not exists palette jsonb not null default '{}'::jsonb;
alter table public.shops add column if not exists site_frame jsonb not null default '{}'::jsonb;
