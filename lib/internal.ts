import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/** API ภายใน: ต้องส่ง header x-internal-key = SHOP_INTERNAL_KEY */
export function authorized(req: Request): boolean {
  const want = process.env.SHOP_INTERNAL_KEY ?? '';
  const got = req.headers.get('x-internal-key') ?? '';
  if (want.length < 32 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
