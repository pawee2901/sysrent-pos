/* แอปร้าน: รับแจ้งเตือน (Web Push) · กดแจ้งเตือนแล้วเปิดหน้าที่เกี่ยวข้อง
   ไม่เก็บแคชหน้าเว็บ (ข้อมูลร้านต้องสดเสมอ) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { title: 'แจ้งเตือนจากร้าน', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'แจ้งเตือนจากร้าน', {
    body: m.body || '', icon: m.icon || '/api/app-icon?size=192', badge: '/api/app-icon?size=96',
    tag: m.tag, renotify: !!m.tag, data: { url: m.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { if (new URL(w.url).origin === self.location.origin) { await w.focus(); return w.navigate(url); } }
    return self.clients.openWindow(url);
  })());
});

// ต้องมี fetch handler ให้เบราว์เซอร์ถือว่าติดตั้งเป็นแอปได้ · ปล่อยผ่านเน็ตตามปกติ
self.addEventListener('fetch', () => {});
