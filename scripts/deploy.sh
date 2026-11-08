#!/usr/bin/env bash
# Deploy Patient Zero on the Vultr server (run ON the server).
#
# Usage:
#   bash scripts/deploy.sh                    # git pull + rebuild/publish frontend
#   bash scripts/deploy.sh --backend          # also republish the Spacetime module
#   bash scripts/deploy.sh --backend --seed   # also reseed the 5,000 residents
#
# From a laptop:
#   ssh root@149.28.246.156 "bash /root/patient-zero/scripts/deploy.sh"

set -euo pipefail

REPO=/root/patient-zero
WEB=/var/www/app
DB=patient-zero-db
SPACETIME=/root/.local/bin/spacetime
SITE=https://149-28-246-156.sslip.io

usage() {
  sed -n '4,7p' "$0" | sed 's/^# \{0,1\}//'
}

BACKEND=0
SEED=0
for arg in "$@"; do
  case "$arg" in
    --backend) BACKEND=1 ;;
    --seed) SEED=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

echo "==> Pulling latest code"
cd "$REPO"
git pull

if [ "$BACKEND" -eq 1 ]; then
  echo "==> Installing Spacetime module dependencies"
  cd "$REPO/backend/spacetime/spacetimedb"
  npm ci

  echo "==> Publishing Spacetime module to $DB"
  cd "$REPO/backend/spacetime"
  "$SPACETIME" publish -s local "$DB" --delete-data=on-conflict -y

  echo "==> Reminder: if this schema change wiped data, reseed with:"
  echo "    python3 simulation/seed_spacetime.py   (or rerun with --seed)"
fi

if [ "$SEED" -eq 1 ]; then
  echo "==> Seeding residents into $DB"
  python3 "$REPO/simulation/seed_spacetime.py"
fi

echo "==> Building frontend"
cd "$REPO/frontend"
if [ ! -f .env.production ]; then
  echo "ERROR: $REPO/frontend/.env.production is missing." >&2
  echo "It must contain VITE_DATA_MODE=live, VITE_SPACETIME_URI and VITE_SPACETIME_DB." >&2
  exit 1
fi
npm ci
npm run build

echo "==> Publishing frontend to $WEB"
rm -rf "${WEB:?}"/*
cp -r dist/* "$WEB"/

echo "Deployed: $SITE"
