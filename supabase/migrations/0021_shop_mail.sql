-- =============================================================
-- SysRent Shop · 0021 ร้านใส่อีเมล Gmail ของตัวเอง สำหรับส่งแจ้งเตือนถึงลูกค้า
--   smtp_pass_enc = App Password เข้ารหัสด้วย ENC_KEY (ไม่เก็บตัวจริง และไม่ส่งกลับไปหน้าเว็บ)
-- รันใน Supabase → SQL Editor หลัง 0020 (รันซ้ำได้)
-- =============================================================
alter table public.shops
  add column if not exists smtp_user text not null default '',
  add column if not exists smtp_pass_enc text not null default '';
