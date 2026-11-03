// ตัวช่วยกลางของต้นแบบ: เปลี่ยนหน้า (#hash) · ธีม/สีร้าน · toast · ข้อมูลตัวอย่าง
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const baht = (n) => '฿' + Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });

// ข้อมูลตัวอย่าง (ร้านจริงดึงจากฐานข้อมูล)
const APPS = {
  netflix: { name: 'Netflix Premium', short: 'N', cls: 'l-netflix', cat: 'ดูหนัง', desc: 'ดูได้ 1 จอ ความชัด 4K HDR · ใช้โปรไฟล์ส่วนตัวพร้อม PIN · รับประกันตลอดอายุแพ็กเกจ', badge: 'ขายดี',
    plans: [{ name: '7 วัน', price: 39 }, { name: '30 วัน', price: 99, old: 129 }, { name: '90 วัน', price: 279, old: 387 }], left: 6, sold: 1284 },
  youtube: { name: 'YouTube Premium', short: '▶', cls: 'l-youtube', cat: 'ดูหนัง', desc: 'ไม่มีโฆษณา · เล่นเบื้องหลังได้ · รวม YouTube Music · เชิญเข้าครอบครัวผ่านอีเมลของคุณ',
    plans: [{ name: '30 วัน', price: 59 }, { name: '1 ปี', price: 590, old: 708 }], left: 12, sold: 932 },
  disney: { name: 'Disney+ Hotstar', short: 'D+', cls: 'l-disney', cat: 'ดูหนัง', desc: 'ดูได้ 1 จอ · Marvel, Star Wars, Pixar ครบ · โปรไฟล์ส่วนตัว',
    plans: [{ name: '30 วัน', price: 69 }, { name: '90 วัน', price: 189 }], left: 3, sold: 410 },
  spotify: { name: 'Spotify Premium', short: 'S', cls: 'l-spotify', cat: 'เพลง', desc: 'ฟังเพลงไม่มีโฆษณา · ดาวน์โหลดฟังออฟไลน์ · ใช้อีเมลของคุณเอง', badge: 'ใหม่',
    plans: [{ name: '30 วัน', price: 49 }, { name: '90 วัน', price: 139 }], left: 20, sold: 356 },
  chatgpt: { name: 'ChatGPT Plus', short: 'AI', cls: 'l-chatgpt', cat: 'ทำงาน', desc: 'ใช้โมเดลล่าสุด · สร้างรูป · วิเคราะห์ไฟล์ · บัญชีแชร์ 1 ที่นั่ง',
    plans: [{ name: '30 วัน', price: 199, old: 249 }], left: 0, sold: 208 },
  canva: { name: 'Canva Pro', short: 'C', cls: 'l-canva', cat: 'ทำงาน', desc: 'เทมเพลตพรีเมียมทั้งหมด · ลบพื้นหลัง · ใช้อีเมลของคุณเอง',
    plans: [{ name: '30 วัน', price: 39 }, { name: '1 ปี', price: 299 }], left: 40, sold: 615 },
  viu: { name: 'Viu Premium', short: 'viu', cls: 'l-viu', cat: 'ดูหนัง', desc: 'ซีรีส์เกาหลีก่อนใคร · ไม่มีโฆษณา · ดูได้ 1 จอ',
    plans: [{ name: '30 วัน', price: 35 }], left: 9, sold: 288 },
  prime: { name: 'Prime Video', short: 'P', cls: 'l-prime', cat: 'ดูหนัง', desc: 'ดูได้ 1 จอ · ซีรีส์ Amazon Original',
    plans: [{ name: '30 วัน', price: 45 }], left: 7, sold: 154 },
};
const logo = (key, size = '') => { const a = APPS[key]; return `<span class="applogo ${size} ${a.cls}" aria-hidden="true">${a.short}</span>`; };

// toast เล็ก ๆ มุมล่าง
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

// สีร้าน + โหมดมืด (จำไว้ในเครื่อง)
function initTheme() {
  const root = document.documentElement;
  const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* โหมดส่วนตัว */ } };
  root.dataset.accent = get('demo-accent', 'indigo');
  root.dataset.theme = get('demo-theme', 'light');
  const bar = document.createElement('div');
  bar.className = 'demo-bar';
  bar.setAttribute('aria-label', 'ทดลองเปลี่ยนสีร้าน');
  const colors = { indigo: '#5b5bd6', pink: '#e64980', emerald: '#0d9f6e', orange: '#ea6a12', sky: '#0e8fd1' };
  bar.innerHTML = Object.entries(colors).map(([k, c]) => `<button class="dot${root.dataset.accent === k ? ' on' : ''}" data-acc="${k}" style="background:${c}" title="สีร้าน: ${k}" aria-label="สี ${k}"></button>`).join('')
    + `<span class="sep"></span><button class="icon-btn" data-dark title="โหมดมืด / สว่าง" aria-label="สลับโหมดมืด">${root.dataset.theme === 'dark' ? '☀️' : '🌙'}</button>`;
  bar.addEventListener('click', (e) => {
    const acc = e.target.closest('[data-acc]');
    if (acc) { root.dataset.accent = acc.dataset.acc; set('demo-accent', acc.dataset.acc); $$('.dot', bar).forEach((d) => d.classList.toggle('on', d === acc)); }
    const dk = e.target.closest('[data-dark]');
    if (dk) { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; set('demo-theme', root.dataset.theme); dk.textContent = root.dataset.theme === 'dark' ? '☀️' : '🌙'; }
  });
  document.body.append(bar);
}

// เปลี่ยนหน้าแบบ #hash — render[ชื่อหน้า]() คืน HTML
function router(render, fallback) {
  const go = () => {
    const [page, arg] = (location.hash.slice(1) || fallback).split('/');
    const fn = render[page] || render[fallback];
    $('#view').innerHTML = fn(arg);
    $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === page));
    window.scrollTo({ top: 0 });
    document.dispatchEvent(new CustomEvent('view', { detail: page }));
  };
  window.addEventListener('hashchange', go);
  go();
}
