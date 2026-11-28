/** สถานะคำขอ OTP เพิ่ม + คำตอบแอดมิน (หน้าประวัติการซื้อ) */
export function OtpAskStatus({ ask, name }: { ask: { status: string; reply: string; extra: number }; name?: string }) {
  const tone = ask.status === 'approved' ? 'var(--ok)' : ask.status === 'rejected' ? 'var(--bad)' : 'var(--warn)';
  const label = ask.status === 'approved' ? `อนุมัติแล้ว · ขอ OTP ได้อีก ${ask.extra} ครั้ง` : ask.status === 'rejected' ? 'แอดมินไม่อนุมัติ' : 'รอแอดมินอนุมัติ';
  return (
    <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 14, background: `color-mix(in srgb, ${tone} 14%, var(--surface))` }}>
      <b>🔐 คำขอ OTP เพิ่ม{name ? ` · ${name}` : ''}</b> <span>· {label}</span>
      {ask.reply && <p style={{ margin: '4px 0 0' }}>💬 ร้านตอบ: {ask.reply}</p>}
    </div>
  );
}
