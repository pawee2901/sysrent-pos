-- =============================================================
-- SysRent Shop · 0006 สีร้านหลากหลาย + สีพื้นหลังเลือกเอง
--   accent   = ชื่อสีสำเร็จรูป (indigo, pink, ...) หรือรหัสสี #rrggbb
--   bg_color = สีพื้นหลัง เมื่อ bg_style = 'color'
--   card_style = สีกล่องบนหน้าร้าน (ขาว / ตามพื้นหลัง / โปร่งแสง)
-- รันใน Supabase → SQL Editor หลัง 0005 (รันซ้ำได้)
-- =============================================================
alter table public.shops drop constraint if exists shops_accent_check;
alter table public.shops add constraint shops_accent_check check (accent ~ '^([a-z]{3,12}|#[0-9a-f]{6})$');

alter table public.shops add column if not exists bg_color text not null default '';
alter table public.shops drop constraint if exists shops_bg_color_check;
alter table public.shops add constraint shops_bg_color_check check (bg_color = '' or bg_color ~ '^#[0-9a-f]{6}$');

alter table public.shops drop constraint if exists shops_bg_style_check;
alter table public.shops add constraint shops_bg_style_check check (bg_style in ('default', 'plain', 'aurora', 'dots', 'image', 'color'));

-- สีกล่อง (การ์ด) บนหน้าร้าน: white = ขาว · tint = ตามสีพื้นหลัง · glass = โปร่งแสง
alter table public.shops add column if not exists card_style text not null default 'white';
alter table public.shops drop constraint if exists shops_card_style_check;
alter table public.shops add constraint shops_card_style_check check (card_style in ('white', 'tint', 'glass'));
