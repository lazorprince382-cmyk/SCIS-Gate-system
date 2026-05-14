#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export VITE_BASE_PATH=/gate/
export VITE_API_URL=http://185.214.134.41/gate-api
export VITE_WS_URL=ws://185.214.134.41/gate-api
npm install --no-audit --no-fund
npm run build
echo "Built frontend to frontend/dist — nginx serves /var/www/scis-gate/frontend/dist/"
