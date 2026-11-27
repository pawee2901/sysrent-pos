-- =============================================================
-- SysRent Shop · 0044 แพ็กเกจเดียว ฿310/เดือน ใช้ได้ทุกฟังก์ชัน
--   ทุกร้านเป็น max (ระบบตัวแทนราคาส่งใน shop_create_order เช็ก plan in ('pro','max'))
--   ค่าตรวจสลิป: ดู 0045
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shops alter column plan set default 'max';

update public.shops set plan = 'max' where plan is distinct from 'max';
-- โควตาสลิป: ดู 0045 (จ่ายตามจริง ฿0.30)
