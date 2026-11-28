import { can } from '@/lib/plan';
import { PlanLock } from '@/components/PlanLock';
import { adminShop } from '@/lib/admin-page';
import { loadLedger } from '@/lib/ledger';
import { AccountingClient } from './AccountingClient';

export const dynamic = 'force-dynamic';

/** บัญชี: ภาพรวมกำไร · สมุดบัญชี (ยอดขาย + รายรับ / รายจ่าย / โอนที่จดเอง) · บัญชีเงินหลายบัญชี · ส่งออก Excel */
export default async function Accounting({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const shop = await adminShop('accounting');
  if (!shop) return null;
  if (!can(shop.plan, 'accounting')) return <PlanLock feature="accounting" />;
  const { p = 'month' } = await searchParams;
  return <AccountingClient l={await loadLedger(shop.id, p)} />;
}
