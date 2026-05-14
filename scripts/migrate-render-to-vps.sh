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

DB_NAME="${DB_NAME:-${DATABASE_URL##*/}}"
DB_NAME="${DB_NAME%%\?*}"
DB_USER="${DB_USER:-gate_user}"

psql_admin() {
  if command -v sudo >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
    sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
  else
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
  fi
}

# Render external Postgres requires TLS.
if [[ "$RENDER_DATABASE_URL" != *"sslmode="* ]]; then
  if [[ "$RENDER_DATABASE_URL" == *\?* ]]; then
    RENDER_DATABASE_URL="${RENDER_DATABASE_URL}&sslmode=require"
  else
    RENDER_DATABASE_URL="${RENDER_DATABASE_URL}?sslmode=require"
  fi
fi

export PGSSLMODE=require

install_pg_client_18() {
  if [[ -x /usr/lib/postgresql/18/bin/pg_dump ]]; then
    return 0
  fi
  echo "Installing PostgreSQL 18 client (Render uses Postgres 18)..."
  apt-get update -qq
  apt-get install -y -qq wget ca-certificates lsb-release gnupg
  install -d /usr/share/postgresql-common/pgdg
  if [[ ! -f /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc ]]; then
    wget -q -O /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
      https://www.postgresql.org/media/keys/ACCC4CF8.asc
  fi
  if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list
  fi
  apt-get update -qq
  apt-get install -y -qq postgresql-client-18
}

resolve_pg_dump() {
  local candidate
  for candidate in \
    /usr/lib/postgresql/18/bin/pg_dump \
    /usr/lib/postgresql/17/bin/pg_dump \
    "$(command -v pg_dump18 2>/dev/null || true)" \
    "$(command -v pg_dump 2>/dev/null || true)"
  do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

install_pg_client_18
PG_DUMP="$(resolve_pg_dump || true)"
if [[ -z "${PG_DUMP:-}" ]]; then
  echo "pg_dump not found after installing postgresql-client-18"
  exit 1
fi
echo "Using $PG_DUMP ($("$PG_DUMP" --version))"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/scis-gate-render-${STAMP}.sql"

echo "Dumping Render database (external host)..."
if ! "$PG_DUMP" --no-owner --no-privileges --dbname="$RENDER_DATABASE_URL" --file="$BACKUP"; then
  if [[ "$PG_DUMP" != /usr/lib/postgresql/18/bin/pg_dump ]]; then
    install_pg_client_18
    PG_DUMP=/usr/lib/postgresql/18/bin/pg_dump
    echo "Retrying with $PG_DUMP ($("$PG_DUMP" --version))"
    "$PG_DUMP" --no-owner --no-privileges --dbname="$RENDER_DATABASE_URL" --file="$BACKUP"
  else
    exit 1
  fi
fi
echo "Saved: $BACKUP ($(wc -c < "$BACKUP") bytes)"

# PG 18 dumps may SET options that older local Postgres does not recognize.
RESTORE_FILE="${BACKUP%.sql}.restore.sql"
sed -E \
  -e '/^SET transaction_timeout/d' \
  -e '/^SET idle_in_transaction_session_timeout/d' \
  "$BACKUP" > "$RESTORE_FILE"
echo "Prepared restore file: $RESTORE_FILE"

echo "Stopping gate API..."
pm2 stop scis-gate || true

restore_failed=1
cleanup() {
  if [[ "$restore_failed" == 1 ]]; then
    echo "Migration did not finish — restarting API..."
  fi
  pm2 restart scis-gate --update-env || true
  pm2 save || true
}
trap cleanup EXIT

echo "Replacing VPS database contents (as postgres superuser)..."
psql_admin -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql_admin -c "ALTER SCHEMA public OWNER TO ${DB_USER};"
psql_admin -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
psql_admin --file="$RESTORE_FILE"
psql_admin -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};"
psql_admin -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};"
psql_admin -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};"
psql_admin -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};"

trap - EXIT
restore_failed=0

echo "Starting gate API..."
pm2 restart scis-gate --update-env
pm2 save

echo "Done."
curl -s http://127.0.0.1:3003/health || true
echo ""
echo "Backup kept at: $BACKUP"
