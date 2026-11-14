-- =============================================================
-- 0032 ปุ่ม "รับรหัส OTP" ในหน้าประวัติการซื้อ / หน้าออเดอร์ — รันซ้ำได้
--   shop_products.otp_app_id = แอป OTP ที่ปุ่มของสินค้านี้ค้นรหัส (shop_otp_apps) · null = ปิดปุ่มทั้งสินค้า
--   shop_stock.otp_email     = อีเมลที่แอดมินใส่เองตอนเพิ่มสต็อก ชิ้นไหนมี = ลูกค้าที่ได้ชิ้นนั้นเห็นปุ่ม (ค้นได้เฉพาะเมลนี้)
--   ใช้ได้เฉพาะร้านแพ็กเกจที่มี "ค้นหา OTP" (Max) และตั้งค่ากล่องอีเมล + แอปในหน้า OTP แล้ว
-- =============================================================
alter table public.shop_products
  add column if not exists otp_app_id uuid references public.shop_otp_apps(id) on delete set null;

alter table public.shop_stock
  add column if not exists otp_email text;
create index if not exists shop_stock_otp_item on public.shop_stock (order_item_id) where otp_email is not null;
