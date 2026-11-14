'use client';
import { useEffect, useRef, useState } from 'react';

/** คลิปสอนใช้งานของแต่ละหน้า (key = path เมนูหลังบ้าน · '' = ภาพรวม) — ไฟล์อยู่ที่ public/tutorials */
const CLIPS: Record<string, { title: string; src: string }> = {
  '': { title: 'วิธีใช้หน้าภาพรวม', src: '/tutorials/overview.mp4' },
  '/orders': { title: 'วิธีจัดการออเดอร์', src: '/tutorials/orders.mp4' },
  '/reports': { title: 'วิธีจัดการเรื่องแจ้งปัญหา', src: '/tutorials/reports.mp4' },
  '/products': { title: 'วิธีเพิ่มและจัดการสินค้า', src: '/tutorials/products.mp4' },
  '/accounts': { title: 'วิธีใช้คลังบัญชี', src: '/tutorials/accounts.mp4' },
  '/coupons': { title: 'วิธีสร้างคูปองส่วนลด', src: '/tutorials/coupons.mp4' },
  '/customers': { title: 'วิธีจัดการลูกค้า', src: '/tutorials/customers.mp4' },
  '/agents': { title: 'วิธีจัดการตัวแทน', src: '/tutorials/agents.mp4' },
  '/otp': { title: 'วิธีตั้งค่าค้นหา OTP', src: '/tutorials/otp.mp4' },
  '/payments': { title: 'วิธีดูการชำระเงินและตั้งบัญชีรับเงิน', src: '/tutorials/payments.mp4' },
  '/accounting': { title: 'วิธีใช้หน้าบัญชี', src: '/tutorials/accounting.mp4' },
  '/settings': { title: 'วิธีตั้งค่าร้าน', src: '/tutorials/settings.mp4' },
  '/renewals': { title: 'วิธีเชื่อม LINE OA สำหรับต่อเมล', src: '/tutorials/renewals.mp4' },
};

/** ปุ่ม "วิธีใช้" บนแถบบน: แสดงเฉพาะหน้าที่มีคลิป · โหลดวิดีโอเมื่อกดเปิดเท่านั้น */
export function TutorialButton({ page }: { page: string }) {
  const clip = CLIPS[page];
  const box = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) box.current?.showModal(); }, [open]);
  useEffect(() => { setOpen(false); }, [page]);
  if (!clip) return null;
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>▶ วิธีใช้</button>
      {open && (
        <dialog ref={box} className="tutorial-dialog" aria-label={clip.title} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === box.current) setOpen(false); }}>
          <div className="tutorial-head">
            <b>{clip.title}</b>
            <button type="button" className="icon-btn" aria-label="ปิด" onClick={() => setOpen(false)}>✕</button>
          </div>
          <video src={clip.src} controls autoPlay playsInline />
        </dialog>
      )}
    </>
  );
}
