import { db } from '@/lib/db';
import { parseContacts, type ContactLink } from '@/lib/contacts';

/** ช่องทางติดต่อของร้าน (หน้าร้าน) · ไม่มีรายการ = ใช้ LINE / Facebook เดิม */
export async function shopContacts(shop: { id: string; line_url: string; facebook_url: string }): Promise<ContactLink[]> {
  const { data, error } = await db().from('shops').select('contact_links').eq('id', shop.id).maybeSingle();
  const list = error ? [] : parseContacts(data?.contact_links);
  if (list.length) return list;
  return [
    shop.line_url && { kind: 'line' as const, url: shop.line_url, label: '', note: '' },
    shop.facebook_url && { kind: 'facebook' as const, url: shop.facebook_url, label: '', note: '' },
  ].filter(Boolean) as ContactLink[];
}
