/* =============================================================
   แพ็กเกจร้าน (shops.plan): starter = ปกติ ฿299 · pro = Pro ฿399 · max = Max ฿799
   ตรวจสลิปเกินโควตาคิดเท่ากันทุกแพ็กเกจ (shops.slip_overage)
   ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และหน้าเว็บ (ไม่มีข้อมูลลับ)
   ============================================================= */

export type Plan = 'starter' | 'pro' | 'max';
export const PLANS: Plan[] = ['starter', 'pro', 'max'];
export const PLAN_LABEL: Record<Plan, string> = { starter: 'ปกติ', pro: 'Pro', max: 'Max' };
export const PLAN_PRICE: Record<Plan, number> = { starter: 299, pro: 399, max: 799 };
/** ตรวจสลิปฟรีต่อเดือน */
export const SLIP_QUOTA: Record<Plan, number> = { starter: 50, pro: 200, max: 500 };
/** จำนวนคูปองสูงสุด (null = ไม่จำกัด) */
export const COUPON_LIMIT: Record<Plan, number | null> = { starter: 3, pro: null, max: null };

export type Feature = 'report' | 'agents' | 'appearance' | 'mail' | 'renewals' | 'line_shop' | 'otp' | 'accounting' | 'staff' | 'export' | 'premium_themes';
const PRO: Feature[] = ['report', 'agents', 'appearance', 'mail', 'renewals', 'line_shop'];
const FEATURES: Record<Plan, Feature[]> = { starter: [], pro: PRO, max: [...PRO, 'otp', 'accounting', 'staff', 'export', 'premium_themes'] };
export const FEATURE_LABEL: Record<Feature, string> = {
  report: 'ปุ่มแจ้งปัญหา', agents: 'ระบบตัวแทนราคาส่ง', appearance: 'ฟอนต์ · เอฟเฟกต์ · เพลง', mail: 'อีเมลแจ้งลูกค้า', renewals: 'ต่อเมลอัตโนมัติผ่าน LINE', line_shop: 'ขายสินค้าใน LINE',
  otp: 'ค้นหา OTP', accounting: 'บัญชี รายรับ ต้นทุน กำไร', staff: 'แอดมินพนักงาน', export: 'ส่งออก Excel', premium_themes: 'ธีมพิเศษทุกแบบ',
};

export const isPlan = (p: string | null | undefined): p is Plan => p === 'starter' || p === 'pro' || p === 'max';
const planOf = (p: string | null | undefined): Plan => (isPlan(p) ? p : 'starter');
/** ร้านแพ็กเกจนี้ใช้ฟีเจอร์นี้ได้ไหม (ค่าแปลก / ไม่มี = ปกติ) */
export const can = (plan: string | null | undefined, feature: Feature) => FEATURES[planOf(plan)].includes(feature);
export const couponLimit = (plan: string | null | undefined) => COUPON_LIMIT[planOf(plan)];
/** แพ็กเกจต่ำสุดที่ได้ฟีเจอร์นี้ */
export const minPlan = (feature: Feature): Plan => PLANS.find((p) => FEATURES[p].includes(feature)) ?? 'max';
