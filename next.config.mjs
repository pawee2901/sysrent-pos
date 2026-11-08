import { readFileSync } from 'node:fs';

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy: เว็บร้านเรียกแค่เซิร์ฟเวอร์ตัวเอง (ข้อมูลทั้งหมดผ่าน API ของเว็บ) — กันสคริปต์แปลกปลอม / ฝัง iframe
const supabaseOrigin = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin; } catch { return ''; } })();
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://static.cloudflareinsights.com https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://cloudflareinsights.com https://challenges.cloudflare.com ${supabaseOrigin}${isDev ? ' ws:' : ''}`,
  "media-src 'self' https:",                          // เพลงร้าน: ลิงก์ไฟล์เสียงภายนอก
  "frame-src https://www.youtube-nocookie.com https://challenges.cloudflare.com", // เพลงร้าน: YouTube · Turnstile
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

// ลิงก์สาธารณะ → โฟลเดอร์จริง (ตารางเดียวกับ lib/routes.ts)
const urls = JSON.parse(readFileSync(new URL('./lib/url-map.json', import.meta.url), 'utf8'));
const taken = new Set(['/admin', '/api', '/_next', ...Object.keys(urls.store), ...Object.values(urls.store)]);
const wanted = process.env.NEXT_PUBLIC_ADMIN_PATH ?? '';
const adminBase = /^\/[a-z0-9][a-z0-9_-]{2,40}$/.test(wanted) && !taken.has(wanted) ? wanted : urls.adminBase;
const aliases = [
  ...Object.entries(urls.admin).map(([real, pub]) => [`/admin${real}`, `${adminBase}${pub}`]),
  ['/admin', adminBase],
  ...Object.entries(urls.store),
];

const nextConfig = {
  env: { NEXT_PUBLIC_ADMIN_PATH: adminBase },
  // auto-update build ลงโฟลเดอร์แยก (NEXT_DIST_DIR) แล้วค่อยสลับ — เว็บที่รันอยู่ไม่พังระหว่าง build
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  serverExternalPackages: ['imapflow', 'mailparser'],
  productionBrowserSourceMaps: false,
  compiler: { removeConsole: isDev ? false : { exclude: ['error'] } },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: `${adminBase}/:path*`, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
  async rewrites() {
    return { beforeFiles: aliases.map(([real, pub]) => ({ source: `${pub}/:path*`, destination: `${real}/:path*` })), afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
