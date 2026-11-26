'use client';
import { to } from '@/lib/routes';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { api } from '@/components/Cart';
import { input, notify } from '@/components/dialog';

/** เมนูผู้ใช้ที่หัวเว็บ: กดรูปโปรไฟล์ → กระเป๋าเงิน / บัญชี / ออเดอร์ / ตะกร้า / รหัสผ่าน / (หลังบ้าน) / ออกจากระบบ */
export function UserMenu({ username, contact, balance, isAdmin, isAgent = false, email = '', mailOn = false, otpOn = false, avatar: avatarInit = '' }: { avatar?: string; otpOn?: boolean; username: string; contact: string; balance: string; isAdmin: boolean; isAgent?: boolean; email?: string; mailOn?: boolean }) {
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
  // รูปโปรไฟล์: ครอปจัตุรัสที่เซิร์ฟเวอร์ · แสดงที่ปุ่มเมนู + การ์ดกิจกรรมของร้าน
  const [avatar, setAvatar] = useState(avatarInit);
  const [upBusy, setUpBusy] = useState(false);
  const pic = useRef<HTMLInputElement>(null);
  async function uploadAvatar(fl?: File) {
    if (!fl) return;
    const fd = new FormData(); fd.append('file', fl);
    setUpBusy(true);
    const r = await api<{ url: string }>('/api/auth/avatar', fd);
    setUpBusy(false);
    if (!r.ok) { notify(r.error, 'error'); return; }
    setAvatar(r.data.url); notify('เปลี่ยนรูปโปรไฟล์แล้ว');
  }
  async function removeAvatar() {
    setOpen(false);
    const r = await api('/api/auth/avatar', undefined, 'DELETE');
    if (!r.ok) { notify(r.error, 'error'); return; }
    setAvatar(''); notify('เอารูปโปรไฟล์ออกแล้ว');
  }
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
        <span className="avatar">{avatar ? <img src={avatar} alt="" /> : initial}</span>
      </button>
      <input ref={pic} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { uploadAvatar(e.target.files?.[0]); e.target.value = ''; }} />
      {open && (
        <div className="umenu-pop" role="menu">
          <div className="umenu-head">
            <button type="button" className="avatar lg umenu-pic" onClick={() => pic.current?.click()} disabled={upBusy} aria-label="เปลี่ยนรูปโปรไฟล์" title="เปลี่ยนรูปโปรไฟล์">
              {avatar ? <img src={avatar} alt="" /> : initial}<i aria-hidden>{upBusy ? '…' : '📷'}</i></button>
            <div><b>{username}</b><small>{contact || `@${username}`}</small>{isAgent && <span className="pill ok umenu-agent">🤝 ตัวแทน · เห็นราคาส่ง</span>}</div>
          </div>
          <Link role="menuitem" href={to('/wallet')}><Icon name="wallet" />กระเป๋าเงิน<b className="umenu-amt">{balance}</b></Link>
          <Link role="menuitem" href={to('/orders')}><Icon name="receipt" />ประวัติการซื้อ · ดูรหัส</Link>
          <Link role="menuitem" href={`${to('/orders')}#app`}><span aria-hidden style={{ width: 20, textAlign: 'center' }}>📲</span>ดาวน์โหลดแอป · แจ้งเตือน</Link>
          <Link role="menuitem" href={to('/cart')}><Icon name="bag" />ตะกร้าสินค้า</Link>
          {otpOn && <Link role="menuitem" href={to('/otp')}><Icon name="lock" />ค้นหา OTP</Link>}
          {mailOn && <button type="button" role="menuitem" onClick={editMail}><Icon name="mail" />{mail ? 'เปลี่ยนอีเมลแจ้งเตือน' : 'เพิ่มอีเมลแจ้งเตือน'}</button>}
          <button type="button" role="menuitem" disabled={upBusy} onClick={() => pic.current?.click()}><span aria-hidden style={{ width: 20, textAlign: 'center' }}>📷</span>{avatar ? 'เปลี่ยนรูปโปรไฟล์' : 'ตั้งรูปโปรไฟล์'}</button>
          {avatar && <button type="button" role="menuitem" onClick={removeAvatar}><span aria-hidden style={{ width: 20, textAlign: 'center' }}>🗑️</span>เอารูปโปรไฟล์ออก</button>}
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
