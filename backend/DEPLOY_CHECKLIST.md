# Backend Deploy Checklist

## Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - at least 24 chars, random
- `ADMIN_USERNAME` - initial admin login
- `ADMIN_PASSWORD` - strong initial password
- `CORS_ORIGINS` - comma-separated frontend origins

Optional:

- `JWT_EXPIRES_IN` (default `8h`)
- `PGSSL` (`false` for local dev)
- `SENTRY_DSN` for monitoring
- `SENTRY_TRACES_SAMPLE_RATE` (default `0`)
- `LOG_LEVEL` (default `info`)

## Migrations

Run before start (already wired in `npm run dev`):

```bash
npm run migrate:up
```

If you changed `ADMIN_PASSWORD` and the admin user already exists:

```bash
npm run admin:reset-password
```

## Backup / Restore

Create backup:

```bash
npm run backup:db
```

Restore backup:

```bash
npm run restore:db -- ./backups/gate-backup-YYYY-MM-DDTHH-MM-SS.sql
```

Notes:

- `pg_dump` and `psql` must be available on the host.
- Keep backups outside the app filesystem in production.

## Monitoring

- Set `SENTRY_DSN` to capture server exceptions.
- Use platform alerts for process restarts and high error rates.
- Verify `/health` endpoint after deploy.

## Security Notes Implemented

- Failed sign-in alerts store username + optional snapshot only (no attempted password).
- Login and failed-report endpoints are rate-limited.
- CORS is restricted via `CORS_ORIGINS`.
