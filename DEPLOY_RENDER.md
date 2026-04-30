# Deploy SCIS Gate System to Render

## 1) Connect GitHub Repo

- Push this project to GitHub.
- In Render, create from Blueprint using the repo.
- Render will read `render.yaml` and create:
  - `scis-gate-system-backend` (Node web service)
  - `scis-gate-system-frontend` (Static site)
  - `scis-gate-system-db` (PostgreSQL)

## 2) Set required secret env vars

In Render dashboard, set these values (they are marked `sync: false`):

- Backend:
  - `ADMIN_PASSWORD` (strong password)
  - `CORS_ORIGINS` (frontend URL, e.g. `https://scis-gate-system-frontend.onrender.com`)
  - `SENTRY_DSN` (optional)
- Frontend:
  - `VITE_API_URL` (backend URL, e.g. `https://scis-gate-system-backend.onrender.com`)
  - `VITE_WS_URL` (backend websocket URL, e.g. `wss://scis-gate-system-backend.onrender.com`)

Then trigger redeploy for both services.

## 3) Startup behavior

- Backend start command is `npm run dev`.
- This runs `migrate:up` before server starts.
- Health check endpoint: `/health`.

## 4) Smoke test after deploy

- Open backend health:
  - `https://<backend>/health` -> should return `{"ok":true,"db":"up"}`
- Open frontend and login with:
  - username: `admin`
  - password: your `ADMIN_PASSWORD`
- Test:
  - create admin account
  - register visit / scan out
  - failed sign-in alert capture + delete

## 5) Ongoing ops

- Backup DB:
  - `npm run backup:db`
- Restore DB:
  - `npm run restore:db -- <backup-file.sql>`
- Rotate admin password after env change:
  - `npm run admin:reset-password`
