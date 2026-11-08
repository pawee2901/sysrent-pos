import { FEATURE_LABEL, PLAN_LABEL, PLAN_PRICE, minPlan, type Feature } from '@/lib/plan';

/** หน้า / ส่วนที่แพ็กเกจปัจจุบันยังใช้ไม่ได้ */
export function PlanLock({ feature }: { feature: Feature }) {
  const p = minPlan(feature);
  return (
    <div className="card plan-lock">
      <div className="plan-lock-ic">🔒</div>
      <h2>{FEATURE_LABEL[feature]}</h2>
      <p className="muted">ฟังก์ชันนี้อยู่ในแพ็กเกจ {PLAN_LABEL[p]} (฿{PLAN_PRICE[p]}/เดือน) ขึ้นไป</p>
      <a className="btn primary" href="https://sysrent.shop" target="_blank" rel="noopener noreferrer">อัปเกรดที่ sysrent.shop</a>
    </div>
  );
}
