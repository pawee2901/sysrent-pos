'use client';
import { api } from '@/components/Cart';

export function LogoutButton() {
  return <button type="button" className="btn ghost sm" onClick={async () => { await api('/api/auth/logout'); window.location.href = '/'; }}>ออกจากระบบ</button>;
}
