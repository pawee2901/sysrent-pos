# ต่อเว็บร้าน (พอร์ต 3002) เข้า nginx ของ sysrent.shop

แก้ `/etc/nginx/sites-available/sysrent` (บล็อก `server_name *.sysrent.shop;`) — ร้านที่อยู่ใน map ไปพอร์ต 3002
ที่เหลือ (เว็บเช่า OTP) ไป 3001 เหมือนเดิม:

```nginx
# วางไว้นอก server { } (ใต้ map $http_upgrade ...)
map $host $sub_upstream {
  default 127.0.0.1:3001;
  include /etc/nginx/shop-hosts.map;
}

# ในบล็อก *.sysrent.shop
  location / {
    proxy_pass http://$sub_upstream;
    include /etc/nginx/sysrent-proxy.conf;
    proxy_read_timeout 60s;
  }
```

ขั้นตอน (root):
1. `touch /etc/nginx/shop-hosts.map` → แก้ไฟล์ตามบนนี้ → `nginx -t && systemctl reload nginx`
2. pm2: เพิ่ม `{ name: 'shop', cwd: '/home/app/shop', script: 'node_modules/next/dist/bin/next', args: 'start -p 3002 -H 127.0.0.1', env: { NODE_ENV: 'production' }, max_memory_restart: '700M' }`
3. crontab root: `* * * * * /home/app/shop/deploy/shop-hosts-sync.sh >/dev/null 2>&1`
