-- =============================================================
-- 0028 ต่อเมลอัตโนมัติผ่าน LINE OA ของร้าน (แพ็กเกจ Pro / Max) — รันซ้ำได้
--
-- เจ้าของร้านเชื่อม LINE OA ของตัวเอง (Channel secret + access token) → ลูกค้าแอด LINE ร้าน
-- แอดมินกรอกลูกค้าต่อเมล (เมลลูกค้า · เมลร้าน/fam · แพ็กเกจ · วันหมดอายุ · แชท LINE)
-- ก่อนหมด N วัน ระบบส่ง LINE เตือน → ลูกค้าเลือกแพ็กเกจ จ่ายในแชท (QR + สลิป) → ระบบเลื่อนวันหมดอายุให้เอง
-- ลูกค้าไม่ต้องมีบัญชีในเว็บร้าน (ผูกด้วย LINE userId)
-- =============================================================

-- ---------- LINE OA ของร้าน (เข้ารหัสด้วย ENC_KEY ก่อนเก็บ) ----------
create table if not exists public.shop_line (
  shop_id     uuid primary key references public.shops(id) on delete cascade,
  secret_enc  text not null,
  token_enc   text not null,
  bot_name    text not null default '',
  basic_id    text not null default '',
  updated_at  timestamptz not null default now()
);

-- ---------- ทุกคนที่ทัก LINE ร้าน (แอดมินเลือกผูกกับรายการต่อเมลได้) ----------
create table if not exists public.shop_line_contacts (
  shop_id       uuid not null references public.shops(id) on delete cascade,
  line_user_id  text not null,
  display_name  text not null default '',
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  primary key (shop_id, line_user_id)
);
create index if not exists shop_line_contacts_seen on public.shop_line_contacts (shop_id, last_seen desc);

-- ---------- รายการต่อเมล ----------
create table if not exists public.shop_renewals (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  customer_email  text not null,                      -- เมลลูกค้า (เมลที่ต่อ)
  fam_email       text not null default '',           -- เมลร้าน / fam ที่ลูกค้าอยู่
  option_id       uuid references public.shop_options(id) on delete set null,   -- แพ็กเกจต่อ (ราคา + จำนวนวัน)
  line_user_id    text,                               -- แชท LINE ของลูกค้า (null = ยังไม่ผูก)
  link_code       text not null,                      -- ลูกค้าพิมพ์รหัสนี้ใน LINE ร้านเพื่อผูก
  expires_on      date not null,
  note            text not null default '',
  status          text not null default 'active' check (status in ('active', 'cancelled')),
  removed_at      timestamptz,                        -- แอดมินลบเมลออกจาก fam แล้ว (ต่อทีหลัง = +ค่าธรรมเนียม)
  reminded_for    date,                               -- เตือนรอบที่หมด expires_on นี้แล้ว
  lapsed_for      date,                               -- แจ้งร้านว่าเลยกำหนดแล้ว ของรอบนี้แล้ว
  renewed_count   int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (shop_id, link_code)
);
create index if not exists shop_renewals_due on public.shop_renewals (shop_id, expires_on) where status = 'active';
create index if not exists shop_renewals_line on public.shop_renewals (shop_id, line_user_id);

-- ---------- QR ต่ออายุที่ส่งให้ลูกค้า (จ่ายในแชท LINE) ----------
create table if not exists public.shop_renewal_pays (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  renewal_id    uuid not null references public.shop_renewals(id) on delete cascade,
  option_id     uuid references public.shop_options(id) on delete set null,
  line_user_id  text not null,
  label         text not null default '',             -- ชื่อแพ็กเกจ ณ ตอนสร้าง
  amount        numeric(12,2) not null check (amount > 0),
  fee           numeric(12,2) not null default 0,      -- ค่าต่อช้า / ต่อหลังลบเมล ที่รวมอยู่ใน amount
  readd         boolean not null default false,        -- ต่อหลังลบเมล → ร้านต้องเพิ่มเมลกลับเข้า fam
  status        text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  attempts      int not null default 0,
  last_error    text,
  trans_ref     text,
  slip          jsonb,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  paid_at       timestamptz,
  new_expires   date
);
create unique index if not exists shop_renewal_pays_ref on public.shop_renewal_pays (shop_id, trans_ref) where trans_ref is not null;
create index if not exists shop_renewal_pays_line on public.shop_renewal_pays (shop_id, line_user_id, created_at desc);

-- ---------- ตั้งค่าต่อเมลของร้าน ----------
alter table public.shops
  add column if not exists renew_remind_days int not null default 3,           -- เตือนก่อนหมดกี่วัน
  add column if not exists renew_grace_days  int not null default 3,           -- ต่อราคาปกติได้ถึง วันหมด + กี่วัน
  add column if not exists renew_late_fee    numeric(10,2) not null default 10, -- เลยกำหนดแล้ว บวกเพิ่ม
  add column if not exists renew_removed_fee numeric(10,2) not null default 20, -- ต่อหลังลบเมลแล้ว บวกเพิ่ม
  add column if not exists renew_fam_size    int not null default 5;           -- 1 เมลร้าน (fam) ใส่ลูกค้าได้กี่เมล

-- ---------- จ่ายแล้ว → เลื่อนวันหมดอายุ (ธุรกรรมเดียว กันสลิปซ้ำทั้งกับการเติมเงินและการต่อเมล) ----------
create or replace function public.shop_renewal_paid(p_pay uuid, p_ref text, p_slip jsonb)
returns date language plpgsql security definer set search_path = public as $$
declare p public.shop_renewal_pays; r public.shop_renewals; days int; new_exp date;
begin
  select * into p from public.shop_renewal_pays where id = p_pay for update;
  if not found then raise exception 'PAY_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  if exists (select 1 from public.shop_renewal_pays where shop_id = p.shop_id and trans_ref = p_ref)
     or exists (select 1 from public.shop_topups where shop_id = p.shop_id and trans_ref = p_ref) then
    raise exception 'DUPLICATE_SLIP';
  end if;
  select * into r from public.shop_renewals where id = p.renewal_id for update;
  if not found then raise exception 'RENEWAL_NOT_FOUND'; end if;
  select coalesce(duration_days, 30) into days from public.shop_options where id = p.option_id;
  days := coalesce(days, 30);
  -- ลบเมลไปแล้ว = เริ่มรอบใหม่จากวันนี้ · ยังอยู่ใน fam = ต่อจากวันหมดเดิม
  new_exp := case when r.removed_at is not null then (now() at time zone 'Asia/Bangkok')::date else r.expires_on end + days;
  update public.shop_renewal_pays set status = 'paid', trans_ref = p_ref, slip = p_slip, paid_at = now(), new_expires = new_exp, last_error = null where id = p.id;
  update public.shop_renewals set expires_on = new_exp, option_id = coalesce(p.option_id, r.option_id), renewed_count = renewed_count + 1,
    removed_at = null, reminded_for = null, lapsed_for = null, updated_at = now() where id = r.id;
  return new_exp;
end; $$;

alter table public.shop_line enable row level security;
alter table public.shop_line_contacts enable row level security;
alter table public.shop_renewals enable row level security;
alter table public.shop_renewal_pays enable row level security;
revoke all on function public.shop_renewal_paid(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.shop_renewal_paid(uuid, text, jsonb) to service_role;
