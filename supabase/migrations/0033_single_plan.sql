-- =============================================================
-- SysRent Shop · 0033 แพ็กเกจเดียว ฿399/เดือน ได้ทุกฟังก์ชัน
--   ทุกร้านเป็น max (ระบบตัวแทนราคาส่งใน shop_create_order เช็ก plan in ('pro','max'))
--   ตรวจสลิปฟรี 500 ใบ/เดือน (ร้านทดลอง / ร้านที่ตั้งโควตาพิเศษไว้ไม่แตะ)
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shops alter column plan set default 'max';
alter table public.shops alter column slip_quota set default 500;
update public.shops set plan = 'max' where plan <> 'max';
update public.shops set slip_quota = 500 where slip_quota in (50, 100, 200); -- โควตาเดิมของแพ็กเกจ (ร้านทดลองที่ตั้งเลขอื่นไว้ไม่แตะ)
