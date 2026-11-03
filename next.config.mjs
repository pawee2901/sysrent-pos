/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy: เว็บร้านเรียกแค่เซิร์ฟเวอร์ตัวเอง (ข้อมูลทั้งหมดผ่าน API ของเว็บ) — กันสคริปต์แปลกปลอม / ฝัง iframe
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://cloudflareinsights.com${isDev ? ' ws:' : ''}`,
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

const nextConfig = {
  // auto-update build ลงโฟลเดอร์แยก (NEXT_DIST_DIR) แล้วค่อยสลับ — เว็บที่รันอยู่ไม่พังระหว่าง build
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: { removeConsole: isDev ? false : { exclude: ['error'] } },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
