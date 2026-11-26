-- =============================================================
-- SysRent Shop · 0043 รูปโปรไฟล์ลูกค้า
--   ลูกค้าอัปรูปเองที่เมนูบัญชี (มุมขวาบน) → แสดงที่ปุ่มเมนู และในการ์ดกิจกรรม "คนเพิ่งซื้อ"
--   รูปเก็บใน bucket shop-media/<ร้าน>/avatars/ · null = ใช้ตัวอักษรแรกของชื่อ
--   ยังไม่รันไฟล์นี้ = หน้าร้านใช้งานได้ตามปกติ แค่อัปรูปโปรไฟล์ไม่ได้
-- รันใน Supabase → SQL Editor (รันซ้ำได้)
-- =============================================================
alter table public.shop_customers add column if not exists avatar_url text;
alter table public.shop_customers drop constraint if exists shop_customers_avatar_len;
alter table public.shop_customers add constraint shop_customers_avatar_len check (avatar_url is null or char_length(avatar_url) <= 500);
