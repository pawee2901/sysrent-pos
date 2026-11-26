-- =============================================================
-- SysRent Shop · 0041 ความมนของปุ่ม / กล่องทั้งร้าน (ตั้งค่าร้าน → หน้าตาร้าน → สี · พื้นหลัง · กล่อง)
--   null = ตามธีม · btn_radius 0–99 px (99 = แคปซูล) · box_radius 0–48 px
--   ยังไม่รันไฟล์นี้ = หน้าร้านใช้งานได้ตามปกติ แค่ตั้งความมนไม่ได้
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shops add column if not exists btn_radius smallint;
alter table public.shops add column if not exists box_radius smallint;
alter table public.shops drop constraint if exists shops_btn_radius_chk;
alter table public.shops add constraint shops_btn_radius_chk check (btn_radius is null or btn_radius between 0 and 99);
alter table public.shops drop constraint if exists shops_box_radius_chk;
alter table public.shops add constraint shops_box_radius_chk check (box_radius is null or box_radius between 0 and 48);
