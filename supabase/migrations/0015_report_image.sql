-- =============================================================
-- SysRent Shop · 0015 แนบรูปตอนลูกค้าแจ้งปัญหา (เช่น ภาพหน้าจอที่เข้าไม่ได้)
-- รันใน Supabase → SQL Editor หลัง 0014 (รันซ้ำได้)
-- =============================================================
alter table public.shop_reports add column if not exists image text not null default '';
