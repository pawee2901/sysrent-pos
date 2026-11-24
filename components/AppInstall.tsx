'use client';
import { useEffect, useState } from 'react';
import { api } from '@/components/Cart';
import { notify } from '@/components/dialog';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Push = 'unsupported' | 'denied' | 'off' | 'on' | 'loading';

const toKey = (b64: string) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
async function swReg() { return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/' }); }

/** การ์ด "ดาวน์โหลดแอปร้าน + รับแจ้งเตือน" (ลูกค้าที่ล็อกอินแล้ว) */
export function AppInstall({ shopName, compact = false }: { shopName: string; compact?: boolean }) {
  const [bip, setBip] = useState<BIP | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [push, setPush] = useState<Push>('loading');
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onBip = (e: Event) => { e.preventDefault(); setBip(e as BIP); };
    const onInstalled = () => { setInstalled(true); setBip(null); };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setPush('unsupported'); return; }
      if (Notification.permission === 'denied') { setPush('denied'); return; }
      const reg = await swReg().catch(() => null);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      setPush(sub ? 'on' : 'off');
    })();
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  async function install() {
    if (bip) { await bip.prompt(); const r = await bip.userChoice; if (r.outcome === 'accepted') setInstalled(true); setBip(null); return; }
    setHelp(true);
  }
  async function turnOn() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPush(perm === 'denied' ? 'denied' : 'off'); notify('ยังไม่ได้อนุญาตการแจ้งเตือน', 'error'); return; }
      const k = await api<{ key: string }>('/api/push/key', undefined, 'GET');
      if (!k.ok) { notify(k.error, 'error'); return; }
      const reg = await swReg();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(k.data.key) });
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await api('/api/push/subscribe', { action: 'on', endpoint: j.endpoint, keys: j.keys });
      if (!r.ok) { await sub.unsubscribe().catch(() => {}); notify(r.error, 'error'); return; }
      setPush('on');
      await api('/api/push/subscribe', { action: 'test' });
      notify('เปิดรับแจ้งเตือนแล้ว 🔔');
    } catch { notify('เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'); } finally { setBusy(false); }
  }
  async function turnOff() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await api('/api/push/subscribe', { action: 'off', endpoint: sub.endpoint }); await sub.unsubscribe().catch(() => {}); }
    setPush('off'); setBusy(false); notify('ปิดการแจ้งเตือนในเครื่องนี้แล้ว');
  }

  // iPhone: ต้องติดตั้งแอปก่อน ถึงจะรับแจ้งเตือนได้ (iOS 16.4 ขึ้นไป)
  const iosNeedsInstall = ios && !installed;
  if (compact && installed && push === 'on') return null;

  return (
    <section className={`card app-install${compact ? ' compact' : ''}`}>
      <div className="app-install-ic" aria-hidden>📲</div>
      <div className="app-install-txt">
        <b>{installed ? `แอป ${shopName}` : `ดาวน์โหลดแอป ${shopName}`}</b>
        <span>{push === 'on' ? 'เปิดรับแจ้งเตือนแล้ว · แจ้งทันทีเมื่อได้ของ คืนเงิน หรือร้านตอบกลับ' : 'ติดตั้งไว้ที่หน้าจอ เปิดง่าย และรับแจ้งเตือนเมื่อได้ของ / ร้านตอบกลับ'}</span>
      </div>
      <div className="app-install-acts">
        {!installed && <button type="button" className="btn sm" onClick={install}>⬇️ ติดตั้งแอป</button>}
        {push === 'off' && !iosNeedsInstall && <button type="button" className="btn primary sm" disabled={busy} onClick={turnOn}>{busy ? 'กำลังเปิด…' : '🔔 เปิดแจ้งเตือน'}</button>}
        {push === 'on' && <button type="button" className="btn ghost sm" disabled={busy} onClick={turnOff}>ปิดแจ้งเตือน</button>}
        {push === 'denied' && <small className="muted">เบราว์เซอร์บล็อกการแจ้งเตือนไว้ · เปิดได้ที่ตั้งค่าเว็บไซต์ (รูปแม่กุญแจข้างลิงก์)</small>}
        {push === 'unsupported' && !iosNeedsInstall && <small className="muted">เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน · ลองใช้ Chrome</small>}
        {iosNeedsInstall && <small className="muted">iPhone: ติดตั้งแอปก่อน แล้วเปิดจากหน้าจอเพื่อรับแจ้งเตือน</small>}
      </div>
      {help && (
        <div className="app-install-help" role="note">
          {ios ? <ol><li>กดปุ่ม <b>แชร์</b> <span aria-hidden>⎋</span> ด้านล่างของ Safari</li><li>เลือก <b>เพิ่มไปยังหน้าจอโฮม</b></li><li>เปิดแอปจากหน้าจอ แล้วกด <b>เปิดแจ้งเตือน</b> ที่หน้านี้</li></ol>
            : <ol><li>กดเมนู <b>⋮</b> ของเบราว์เซอร์ (มุมขวาบน)</li><li>เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b></li></ol>}
          <button type="button" className="btn ghost sm" onClick={() => setHelp(false)}>เข้าใจแล้ว</button>
        </div>
      )}
    </section>
  );
}
