import { templateOf } from '@/lib/templates';

/** รูปสินค้า: รูปที่ร้านอัปโหลด → ถ้าไม่มีใช้ตัวอักษรบนสีแบรนด์ของแม่แบบ → ถ้าไม่มีแม่แบบใช้ตัวแรกของชื่อ */
export function AppLogo({ image, template, name, size = '' }: { image?: string; template?: string; name: string; size?: '' | 'lg' | 'xl' }) {
  if (image) return <span className={`applogo ${size}`} style={{ background: '#fff', overflow: 'hidden', padding: 0 }}><img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>;
  const t = template ? templateOf(template) : undefined;
  return (
    <span className={`applogo ${size}`} style={{ background: t?.bg ?? 'var(--accent)', color: t?.fg ?? '#fff' }} aria-hidden>
      {t?.short ?? name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
