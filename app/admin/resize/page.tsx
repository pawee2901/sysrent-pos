import { adminShop } from '@/lib/admin-page';
import { ImageShrinker } from './ImageShrinker';

/** หลังบ้าน → ย่อรูป (เครื่องมือ · แอดมินทุกคนใช้ได้) */
export default async function ResizePage() {
  if (!(await adminShop())) return null;
  return <ImageShrinker />;
}
