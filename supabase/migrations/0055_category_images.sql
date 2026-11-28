-- =============================================================
-- SysRent Shop · 0055 รูปปกหมวดหมู่
--   shops.category_images = { "ชื่อหมวด": "https://...รูป" } ใช้กับกล่อง "ปุ่มหมวดสินค้า" แบบรูปปกใหญ่
--   ยังไม่รันไฟล์นี้ = ไม่มีรูปปก (หมวดแบบไอคอนใช้ได้ตามเดิม)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shops add column if not exists category_images jsonb not null default '{}'::jsonb;
