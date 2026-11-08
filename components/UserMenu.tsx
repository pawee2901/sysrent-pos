'use client';
import { to } from '@/lib/routes';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { api } from '@/components/Cart';
import { input, notify } from '@/components/dialog';

/** เมนูผู้ใช้ที่หัวเว็บ: กดรูปโปรไฟล์ → กระเป๋าเงิน / บัญชี / ออเดอร์ / ตะกร้า / รหัสผ่าน / (หลังบ้าน) / ออกจากระบบ */
export function UserMenu({ username, contact, balance, isAdmin, isAgent = false, email = '', mailOn = false, otpOn = false }: { otpOn?: boolean; username: string; contact: string; balance: string; isAdmin: boolean; isAgent?: boolean; email?: string; mailOn?: boolean }) {
  const [mail, setMail] = useState(email);
  async function editMail() {
    setOpen(false);
    const v = await input('อีเมลรับแจ้งเตือน', { text: 'แจ้งเมื่อร้านส่งสินค้าสั่งทำ หรือคืนเงิน', value: mail, placeholder: 'you@email.com', ok: 'บันทึก', max: 120, check: (s) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? null : 'อีเมลไม่ถูกต้อง') });
    if (!v) return;
    const r = await api('/api/auth/email', { email: v });
    if (!r.ok) { notify(r.error, 'error'); return; }
    setMail(v.toLowerCase()); notify('บันทึกอีเมลแล้ว');
  }
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', click); window.removeEventListener('keydown', esc); };
  }, [open]);

  const initial = username.slice(0, 1).toUpperCase();
  return (
    <div className="umenu" ref={box}>
      <button type="button" className="icon-btn umenu-btn" aria-haspopup="menu" aria-expanded={open} aria-label="เมนูบัญชี" onClick={() => setOpen(!open)}>
        <span className="avatar">{initial}</span>
      </button>
      {open && (
        <div className="umenu-pop" role="menu">
          <div className="umenu-head">
            <span className="avatar lg">{initial}</span>
            <div><b>{username}</b><small>{contact || `@${username}`}</small>{isAgent && <span className="pill ok umenu-agent">🤝 ตัวแทน · เห็นราคาส่ง</span>}</div>
          </div>
          <Link role="menuitem" href={to('/wallet')}><Icon name="wallet" />กระเป๋าเงิน<b className="umenu-amt">{balance}</b></Link>
          <Link role="menuitem" href={to('/orders')}><Icon name="receipt" />ประวัติการซื้อ · ดูรหัส</Link>
          <Link role="menuitem" href={to('/cart')}><Icon name="bag" />ตะกร้าสินค้า</Link>
          {otpOn && <Link role="menuitem" href={to('/otp')}><Icon name="lock" />ค้นหา OTP</Link>}
          {mailOn && <button type="button" role="menuitem" onClick={editMail}><Icon name="mail" />{mail ? 'เปลี่ยนอีเมลแจ้งเตือน' : 'เพิ่มอีเมลแจ้งเตือน'}</button>}
          <Link role="menuitem" href={to('/my/password')}><Icon name="lock" />ตั้งรหัสผ่าน</Link>
          {isAdmin && <a role="menuitem" href={to('/admin')}><Icon name="shield" />หลังบ้านร้าน</a>}
          <hr />
          <button type="button" role="menuitem" className="umenu-out" onClick={async () => { await api('/api/auth/logout'); window.location.href = '/'; }}>
            <Icon name="logout" />ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}
