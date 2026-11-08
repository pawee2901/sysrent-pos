import { loginUrl } from '@/lib/routes';
import { redirect } from 'next/navigation';
import { getCustomer } from '@/lib/auth';
import { PasswordForm } from './PasswordForm';

export const dynamic = 'force-dynamic';

/** เปลี่ยนรหัสผ่านของลูกค้า */
export default async function Password() {
  const me = await getCustomer();
  if (!me) redirect(loginUrl('/my/password'));
  return (
    <div style={{ maxWidth: 420, margin: '20px auto' }}>
      <div className="sec-head"><h1 style={{ fontSize: 26 }}>ตั้งรหัสผ่าน</h1><span className="muted" style={{ fontSize: 14 }}>@{me.username}</span></div>
      <div className="card card-pad"><PasswordForm /></div>
    </div>
  );
}
