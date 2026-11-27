-- =============================================================
-- SysRent Shop · 0044 แพ็กเกจเดียว ฿310/เดือน ใช้ได้ทุกฟังก์ชัน
--   ทุกร้านเป็น max (ระบบตัวแทนราคาส่งใน shop_create_order เช็ก plan in ('pro','max'))
--   ตรวจสลิปฟรี 500 ใบ/เดือน (ร้านที่ตั้งโควตาพิเศษไว้ไม่แตะ)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shops alter column plan set default 'max';
alter table public.shops alter column slip_quota set default 500;
update public.shops set plan = 'max' where plan is distinct from 'max';
update public.shops set slip_quota = 500 where slip_quota in (50, 100, 200);
