#!/usr/bin/env bash
# One-time server setup for SysRent Shop (port 3002). Run as root; safe to re-run.
# Normally started by deploy/install-server.ps1, which uploads .env.local first.
set -euo pipefail
APP=/home/app/shop
ENV_FILE=$APP/.env.local
CONF=/etc/nginx/sites-available/sysrent
die() { echo "!! $1" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "missing $ENV_FILE"
for k in NEXT_PUBLIC_SUPABASE_URL ENC_KEY SHOP_INTERNAL_KEY NEXT_PUBLIC_TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY NEXT_PUBLIC_ADMIN_PATH; do
  grep -qE "^$k=.+" "$ENV_FILE" || die "$k is empty in .env.production.local"
done
if grep -qE '^(DEV_SHOP_SLUG=.+|NEXT_PUBLIC_TURNSTILE_SITE_KEY=[123]x0000)' "$ENV_FILE"; then die "remove DEV_SHOP_SLUG and Cloudflare test keys from .env.production.local"; fi

# The auto-update cron also builds this folder: mark this commit as deployed, then wait for any running update
sudo -iu app git -C "$APP" rev-parse origin/main > /home/app/.deployed-shop
chown app:app /home/app/.deployed-shop
for _ in $(seq 1 180); do pgrep -u app -f 'auto-update' >/dev/null || break; sleep 5; done
pgrep -u app -f 'auto-update' >/dev/null && die "auto-update is still running; try again in a few minutes"

echo ">> build (a few minutes)"
sudo -iu app bash -c 'cd ~/shop && npm ci --no-audit --no-fund && rm -rf .next-build && NEXT_DIST_DIR=.next-build npm run build && rm -rf .next-old && { [ ! -d .next ] || mv .next .next-old; } && mv .next-build .next && sha1sum package-lock.json | cut -c1-40 > node_modules/.lock-hash'

echo ">> pm2"
if sudo -iu app pm2 describe shop >/dev/null 2>&1; then
  sudo -iu app pm2 reload shop --update-env >/dev/null
else
  sudo -iu app bash -c 'cd ~/shop && NODE_ENV=production pm2 start node_modules/next/dist/bin/next --name shop --max-memory-restart 700M -- start -p 3002 -H 127.0.0.1 >/dev/null'
fi
sudo -iu app pm2 save >/dev/null
sudo -iu app git -C "$APP" rev-parse origin/main > /home/app/.deployed-shop
chown app:app /home/app/.deployed-shop

for _ in $(seq 1 30); do curl -s -o /dev/null -m 3 http://127.0.0.1:3002/ && break; sleep 1; done

echo ">> nginx"
touch /etc/nginx/shop-hosts.map
if ! grep -q 'sub_upstream' "$CONF"; then
  [ "$(grep -c 'proxy_pass http://127.0.0.1:3001;' "$CONF")" = 1 ] || die "expected exactly one proxy to port 3001 in $CONF; nothing changed"
  grep -q '^map \$http_upgrade' "$CONF" || die "map \$http_upgrade not found in $CONF; nothing changed"
  cp "$CONF" "$CONF.before-shop"
  sed -i 's#proxy_pass http://127.0.0.1:3001;#proxy_pass http://$sub_upstream;#' "$CONF"
  sed -i '/^map \$http_upgrade/a map $host $sub_upstream {\n  default 127.0.0.1:3001;\n  include /etc/nginx/shop-hosts.map;\n}' "$CONF"
  if ! nginx -t >/dev/null 2>&1; then cp "$CONF.before-shop" "$CONF"; die "nginx test failed; original config restored"; fi
  systemctl reload nginx
fi

echo ">> cron"
LINE="* * * * * bash $APP/deploy/shop-hosts-sync.sh >/dev/null 2>&1"
( crontab -l 2>/dev/null | grep -v 'shop-hosts-sync' || true; echo "$LINE" ) | crontab -
bash "$APP/deploy/shop-hosts-sync.sh" || echo "!! host sync failed; cron will retry every minute"

echo "done: shops on port 3002, other subdomains unchanged on 3001"
