#!/usr/bin/env bash
# Migrate Render Postgres data into the VPS scis_gate database.
# Usage on VPS:
#   export RENDER_DATABASE_URL='postgres://...'   # External URL from Render dashboard
#   bash /var/www/scis-gate/scripts/migrate-render-to-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${RENDER_DATABASE_URL:-}" ]]; then
  echo "Set RENDER_DATABASE_URL to the Render Postgres external connection string."
  exit 1
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL missing in backend/.env"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/scis-gate-render-${STAMP}.sql"

echo "Dumping Render database..."
pg_dump --no-owner --no-privileges --dbname="$RENDER_DATABASE_URL" --file="$BACKUP"
echo "Saved: $BACKUP"

echo "Stopping gate API..."
pm2 stop scis-gate || true

echo "Replacing VPS database contents..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO gate_user;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gate_user;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --file="$BACKUP"

echo "Starting gate API..."
pm2 restart scis-gate
pm2 save

echo "Done. Verify: curl -s http://127.0.0.1:3003/health"
echo "Backup kept at: $BACKUP"
