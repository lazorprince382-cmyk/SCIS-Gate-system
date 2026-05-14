#!/usr/bin/env bash
# Migrate Render Postgres data into the VPS scis_gate database.
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
  echo "Set RENDER_DATABASE_URL to the Render Postgres EXTERNAL connection string."
  exit 1
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL missing in backend/.env"
  exit 1
fi

# Render external Postgres requires TLS.
if [[ "$RENDER_DATABASE_URL" != *"sslmode="* ]]; then
  if [[ "$RENDER_DATABASE_URL" == *\?* ]]; then
    RENDER_DATABASE_URL="${RENDER_DATABASE_URL}&sslmode=require"
  else
    RENDER_DATABASE_URL="${RENDER_DATABASE_URL}?sslmode=require"
  fi
fi

export PGSSLMODE=require

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Installing postgresql-client..."
  apt-get update -qq && apt-get install -y -qq postgresql-client
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/scis-gate-render-${STAMP}.sql"

echo "Dumping Render database (external host)..."
pg_dump --no-owner --no-privileges --dbname="$RENDER_DATABASE_URL" --file="$BACKUP"
echo "Saved: $BACKUP ($(wc -c < "$BACKUP") bytes)"

echo "Stopping gate API..."
pm2 stop scis-gate || true

echo "Replacing VPS database contents..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO gate_user;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gate_user;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --file="$BACKUP"

echo "Starting gate API..."
pm2 restart scis-gate --update-env
pm2 save

echo "Done."
curl -s http://127.0.0.1:3003/health || true
echo ""
echo "Backup kept at: $BACKUP"
