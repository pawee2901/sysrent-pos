-- =============================================================
-- SysRent Shop · 0008 รับเงินอัตโนมัติจากแจ้งเตือนธนาคาร (ฟรี ไม่ต้องใช้บริการตรวจสลิป)
--   ลูกค้าโอนยอดมีเศษสตางค์ไม่ซ้ำ (เช่น 100.37) → มือถือร้านส่งต่อแจ้งเตือน "เงินเข้า" มาที่เว็บ
--   → จับคู่ยอดกับรายการเติมเงินที่รออยู่ → เงินเข้ากระเป๋า (+ จ่ายออเดอร์ต่อ)
--   + ตรวจสลิปเอง: อ่าน QR บนสลิป (ฟรี) กันสลิปซ้ำ · AI อ่านยอด/ผู้รับ (ถ้าตั้งคีย์)
-- รันใน Supabase → SQL Editor หลัง 0007 (รันซ้ำได้)
-- =============================================================

-- กุญแจลับของลิงก์รับแจ้งเตือน (เก็บเป็น hash · ร้านสร้างใหม่ได้ในหลังบ้าน)
alter table public.shops
  add column if not exists bank_hook_hash text,
  add column if not exists bank_hook_seen timestamptz;                      -- ได้รับแจ้งเตือนล่าสุดเมื่อไหร่ (ไว้บอกร้านว่ามือถือยังส่งอยู่)

-- ยอดที่รอโอน ห้ามซ้ำกันในร้านเดียว (ยอดมีเศษสตางค์ = ตัวระบุว่าเงินก้อนนี้ของใคร)
-- รายการค้างจากระบบเดิมอาจยอดซ้ำกัน → ปิดก่อนสร้าง index (ถ้าเงินเข้าทีหลัง ระบบยังรับรายการที่หมดเวลาได้)
update public.shop_topups set status = 'expired' where status = 'pending'
  and not exists (select 1 from pg_indexes where indexname = 'shop_topups_pending_amount');
create unique index if not exists shop_topups_pending_amount on public.shop_topups (shop_id, amount) where status = 'pending';

-- เลขอ้างอิงจาก QR บนสลิป (อ่านเองฟรี) → สลิปใบเดียวใช้ได้ครั้งเดียวในร้าน
alter table public.shop_topups add column if not exists slip_ref text;
create unique index if not exists shop_topups_slip_ref on public.shop_topups (shop_id, slip_ref) where slip_ref is not null;

-- แจ้งเตือนที่ได้รับ (เก็บไว้ตรวจย้อนหลัง · จับคู่ไม่ได้ = ร้านเห็นในหลังบ้าน)
create table if not exists public.shop_bank_events (
  id          bigint generated always as identity primary key,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  amount      numeric(12,2),                                               -- null = อ่านยอดไม่ได้ / ไม่ใช่เงินเข้า
  raw         text not null,
  dedupe      text not null,                                               -- hash ข้อความ (แอปส่งซ้ำ = ไม่นับซ้ำ)
  topup_id    uuid references public.shop_topups(id) on delete set null,
  result      text not null,                                               -- matched / no_match / ignored / duplicate
  created_at  timestamptz not null default now()
);
create unique index if not exists shop_bank_events_dedupe on public.shop_bank_events (shop_id, dedupe);
create index if not exists shop_bank_events_shop on public.shop_bank_events (shop_id, created_at desc);
alter table public.shop_bank_events enable row level security;
grant all on public.shop_bank_events to service_role;
grant usage, select on sequence public.shop_bank_events_id_seq to service_role;

-- เงินเข้าจริง → เติมกระเป๋า (รับได้ทั้งรายการที่รออยู่ และที่เพิ่งหมดเวลา เพราะเงินเข้าแล้วจริง)
create or replace function public.shop_credit_bank(p_topup uuid, p_ref text, p_info jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
declare r public.shop_topups; nb numeric(12,2);
begin
  select * into r from public.shop_topups where id = p_topup for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('pending', 'expired') then raise exception 'NOT_PENDING'; end if;
  update public.shop_topups set status = 'paid', trans_ref = p_ref, slip = p_info, paid_at = now(), last_error = null where id = r.id;
  update public.shop_customers set balance = balance + r.amount where id = r.customer_id returning balance into nb;
  insert into public.shop_wallet_tx (shop_id, customer_id, kind, amount, balance_after, ref_id, note)
  values (r.shop_id, r.customer_id, 'topup', r.amount, nb, r.id, 'เติมเงินพร้อมเพย์ (ตรวจเงินเข้าอัตโนมัติ)');
  return nb;
end; $$;
revoke all on function public.shop_credit_bank(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.shop_credit_bank(uuid, text, jsonb) to service_role;
