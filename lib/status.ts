/** ป้ายสถานะออเดอร์ / รายการ (ใช้ทั้งหน้าร้านและหลังบ้าน) */
export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'รอชำระ', tone: 'warn' },
  processing: { label: 'รอร้านส่งของ', tone: 'warn' },
  completed: { label: 'สำเร็จ', tone: 'ok' },
  cancelled: { label: 'ยกเลิก', tone: '' },
  refunded: { label: 'คืนเงินแล้ว', tone: 'bad' },
};
export const ITEM_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'รอชำระ', tone: 'warn' },
  queued: { label: 'รอร้านส่ง', tone: 'warn' },
  delivered: { label: 'ส่งแล้ว', tone: 'ok' },
  refunded: { label: 'คืนเงินแล้ว', tone: 'bad' },
};
