import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Supabase ด้วย service role — ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น (ตารางร้านไม่มี policy ให้เบราว์เซอร์อ่านตรง) */
export function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
