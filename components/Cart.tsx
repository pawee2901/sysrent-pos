'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** ตะกร้าเก็บในเครื่องลูกค้า (แยกตามร้าน) — ราคาจริงคิดใหม่ที่เซิร์ฟเวอร์ตอนสร้างออเดอร์ */
export type CartLine = { optionId: string; productId: string; name: string; option: string; price: number; qty: number; image: string; template: string; maxQty: number };
type Cart = { lines: CartLine[]; ready: boolean; count: number; total: number; add: (l: CartLine) => void; setQty: (id: string, q: number) => void; remove: (id: string) => void; clear: () => void };

const Ctx = createContext<Cart | null>(null);
const load = (key: string): CartLine[] => {
  try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v.slice(0, 20) : []; } catch { return []; }
};

export function CartProvider({ shop, children }: { shop: string; children: React.ReactNode }) {
  const key = `cart:${shop}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { setLines(load(key)); setReady(true); }, [key]);
  useEffect(() => { if (ready) try { localStorage.setItem(key, JSON.stringify(lines)); } catch { /* โหมดส่วนตัว */ } }, [lines, ready, key]);

  const add = useCallback((l: CartLine) => setLines((cur) => {
    const f = cur.find((x) => x.optionId === l.optionId);
    if (f) return cur.map((x) => (x.optionId === l.optionId ? { ...x, qty: Math.min(x.qty + l.qty, l.maxQty, 20) } : x));
    return [...cur, { ...l, qty: Math.min(l.qty, l.maxQty, 20) }].slice(-20);
  }), []);
  const setQty = useCallback((id: string, q: number) => setLines((cur) => cur.map((x) => (x.optionId === id ? { ...x, qty: Math.max(1, Math.min(q, x.maxQty, 20)) } : x))), []);
  const remove = useCallback((id: string) => setLines((cur) => cur.filter((x) => x.optionId !== id)), []);
  const clear = useCallback(() => setLines([]), []);
  const value = useMemo(() => ({ lines, ready, add, setQty, remove, clear, count: lines.reduce((s, l) => s + l.qty, 0), total: lines.reduce((s, l) => s + l.qty * l.price, 0) }), [lines, ready, add, setQty, remove, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart outside CartProvider');
  return c;
}

export function CartCount({ className = 'badge' }: { className?: string }) {
  const { count } = useCart();
  return count > 0 ? <span className={className}>{count > 99 ? '99+' : count}</span> : null;
}

export const baht = (n: number) => '฿' + Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });

/** POST JSON ไป API ของร้าน — คืน { ok, data, error } */
export async function api<T = Record<string, unknown>>(url: string, body?: unknown, method = 'POST'): Promise<{ ok: boolean; data: T; error: string; status: number }> {
  const isForm = body instanceof FormData;
  const r = await fetch(url, { method, headers: isForm || body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: isForm ? body : body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  const j = (await r?.json().catch(() => ({}))) ?? {};
  return { ok: !!r?.ok, data: j as T, error: (j as { error?: string }).error ?? (r ? 'ทำรายการไม่สำเร็จ' : 'เชื่อมต่อไม่ได้ กรุณาลองใหม่'), status: r?.status ?? 0 };
}
