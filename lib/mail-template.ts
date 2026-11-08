/** อีเมลแจ้งลูกค้า: ส่งสินค้าแล้ว / ทำให้ไม่ได้ คืนเงินแล้ว — ไม่ใส่รหัสบัญชีในอีเมล ให้ลูกค้าดูที่หน้าประวัติการซื้อ */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export type ItemMail = { shopName: string; code: string; product: string; url: string; color: string } & ({ kind: 'deliver' } | { kind: 'refund'; amount: string; reason: string });

export function itemMail(m: ItemMail): { subject: string; html: string; text: string } {
  const done = m.kind === 'deliver';
  const subject = done ? `${m.shopName}: จัดส่งสินค้าเรียบร้อยแล้ว (ออเดอร์ #${m.code})` : `${m.shopName}: ไม่สามารถทำสินค้าให้ได้ คืนเงินแล้ว (ออเดอร์ #${m.code})`;
  const lines = done
    ? ['ร้านทำสินค้าของคุณเสร็จและจัดส่งเรียบร้อยแล้ว', 'ดูรายละเอียดและรหัสได้ที่หน้าประวัติการซื้อ กด "แสดงไอดี" ที่ออเดอร์นี้']
    : [`ขออภัย ร้านไม่สามารถทำสินค้านี้ให้ได้ จึงคืนเงิน ${m.amount} เข้ากระเป๋าเงินในร้านของคุณแล้ว`, `เหตุผล: ${m.reason}`];
  const text = [subject, '', `สินค้า: ${m.product}`, ...lines, '', m.url].join('\n');
  const html = `<div style="background:#f6f7fb;padding:24px 12px;font-family:Tahoma,sans-serif;color:#1f2333">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 24px">
    <div style="font-size:14px;color:#6b7080">${esc(m.shopName)}</div>
    <h1 style="font-size:20px;margin:6px 0 16px">${done ? '✅ จัดส่งสินค้าเรียบร้อยแล้ว' : '💸 ทำสินค้าให้ไม่ได้ คืนเงินแล้ว'}</h1>
    <p style="margin:0 0 4px"><b>ออเดอร์ #${esc(m.code)}</b></p>
    <p style="margin:0 0 16px;color:#6b7080">${esc(m.product)}</p>
    ${lines.map((l) => `<p style="margin:0 0 8px;line-height:1.6">${esc(l)}</p>`).join('')}
    <a href="${esc(m.url)}" style="display:inline-block;margin-top:14px;padding:12px 22px;border-radius:999px;background:${esc(m.color)};color:#fff;text-decoration:none;font-weight:bold">${done ? 'ไปรับสินค้า' : 'ดูประวัติการซื้อ'}</a>
  </div>
</div>`;
  return { subject, html, text };
}
