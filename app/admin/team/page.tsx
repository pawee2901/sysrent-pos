import { db } from '@/lib/db';
import { adminKind } from '@/lib/auth';
import { adminShop, when } from '@/lib/admin-page';
import { can } from '@/lib/plan';
import { cleanPerms } from '@/lib/perms';
import { TeamClient, type Member } from './TeamClient';

export const dynamic = 'force-dynamic';

/** ทีมงาน: ลูกค้าที่ร้านตั้งยศแอดมิน + เมนูที่แต่ละคนเข้าได้ (จัดการได้เฉพาะเจ้าของร้าน) */
export default async function AdminTeam() {
  const shop = await adminShop('customers');
  if (!shop) return null;
  const owner = (await adminKind()) === 'owner';
  const d = db();
  // ยังไม่รัน 0018 = ไม่มี admin_perms (ใช้สิทธิ์เริ่มต้น) · ยังไม่รัน 0017 = ไม่มี role
  let q = await d.from('shop_customers').select('id, username, contact, blocked, created_at, admin_perms').eq('shop_id', shop.id).eq('role', 'admin').order('created_at').limit(100);
  if (q.error && /admin_perms/.test(q.error.message)) q = await d.from('shop_customers').select('id, username, contact, blocked, created_at').eq('shop_id', shop.id).eq('role', 'admin').order('created_at').limit(100) as typeof q;
  type R = { id: string; username: string; contact: string; blocked: boolean; created_at: string; admin_perms?: unknown };
  const rows = (q.data ?? []) as R[];
  // เข้าหลังบ้านล่าสุด (session ของบัญชีนั้น)
  const { data: ss } = rows.length ? await d.from('shop_sessions').select('customer_id, created_at').in('customer_id', rows.map((r) => r.id)).order('created_at', { ascending: false }).limit(500) : { data: [] };
  const seen = new Map<string, string>();
  for (const s of (ss ?? []) as { customer_id: string; created_at: string }[]) if (!seen.has(s.customer_id)) seen.set(s.customer_id, s.created_at);
  const members: Member[] = rows.map((r) => ({
    id: r.id, username: r.username, contact: r.contact, blocked: r.blocked, since: when(r.created_at),
    perms: cleanPerms(r.admin_perms), seen: seen.has(r.id) ? when(seen.get(r.id)!) : '',
  }));
  return <TeamClient members={members} owner={owner} enabled={can(shop.plan, 'staff')} ready={!q.error} />;
}
