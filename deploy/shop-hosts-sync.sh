#!/usr/bin/env bash
# สร้าง /etc/nginx/shop-hosts.map จากรายชื่อร้านที่เปิดอยู่ แล้ว reload nginx เมื่อมีการเปลี่ยน
# รันด้วย root ทุก 1 นาที:  * * * * * /home/app/shop/deploy/shop-hosts-sync.sh >/dev/null 2>&1
set -euo pipefail
ENV=/home/app/shop/.env.local
KEY=$(grep -E '^SHOP_INTERNAL_KEY=' "$ENV" | cut -d= -f2- | tr -d '\r"'"'"' ')
ROOT=$(grep -E '^SHOP_ROOT_DOMAIN=' "$ENV" | cut -d= -f2- | tr -d '\r"'"'"' ' || true); ROOT=${ROOT:-sysrent.shop}
MAP=/etc/nginx/shop-hosts.map
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

JSON=$(curl -fsS --max-time 10 -H "x-internal-key: $KEY" http://127.0.0.1:3002/api/internal/shops)
# ร้านเปิดไม่ได้ (เช่น แอปล่ม) → ไม่แตะ map เดิม
echo "$JSON" | grep -q '"ok":true' || exit 0
echo "$JSON" | grep -oE '"slugs":\[[^]]*\]' | grep -oE '"[a-z0-9-]{3,30}"' | tr -d '"' | sort -u \
  | sed -E '/^(demo|demo-agent)$/d' \
  | while read -r s; do echo "$s.$ROOT 127.0.0.1:3002;"; done > "$TMP"

touch "$MAP"
if ! cmp -s "$TMP" "$MAP"; then
  cp "$MAP" "$MAP.bak"
  cp "$TMP" "$MAP"
  if nginx -t >/dev/null 2>&1; then systemctl reload nginx; else cp "$MAP.bak" "$MAP"; fi
fi

# สรุปยอดรายวันเข้า Discord: วันละครั้งหลัง 00:05 เวลาไทย · เรียกไม่สำเร็จ = ลองใหม่นาทีถัดไป
# TZ=ICT-7 เป็นรูปแบบ POSIX ไม่ต้องพึ่ง tzdata บนเครื่อง
DAILY=/var/lib/shop-daily-summary
DAY=$(TZ=ICT-7 date +%F)
if [ "$((10#$(TZ=ICT-7 date +%H%M)))" -ge 5 ] && [ "$(cat "$DAILY" 2>/dev/null || true)" != "$DAY" ]; then
  if curl -fsS --max-time 20 -X POST -H "x-internal-key: $KEY" http://127.0.0.1:3002/api/internal/daily-summary >/dev/null; then
    echo "$DAY" > "$DAILY"
  fi
fi

# ต่อเมลผ่าน LINE: เตือนลูกค้าก่อนหมด / แจ้งร้านเมื่อเลยกำหนด (ทุก 1 นาที · ไม่สำเร็จ = รอบหน้าทำใหม่)
curl -fsS --max-time 50 -X POST -H "x-internal-key: $KEY" http://127.0.0.1:3002/api/internal/renewals >/dev/null || true
