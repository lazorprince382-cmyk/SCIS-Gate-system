import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';

const { Pool } = pg;

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const SENTRY_DSN = process.env.SENTRY_DSN || '';
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required (PostgreSQL connection string).');
}
if (!JWT_SECRET || JWT_SECRET.length < 24) {
  throw new Error('JWT_SECRET is required and should be at least 24 characters.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
});

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'scis-gate-system-backend' },
});

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    environment: process.env.NODE_ENV || 'development',
  });
}

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (CORS_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '12mb' }));
app.use(pinoHttp({ logger }));

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const failedReportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed sign-in reports. Please try again later.' },
});

const scanSessions = new Map();

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch {
    res.status(500).json({ ok: false, db: 'down' });
  }
});

function nowIso() {
  return new Date().toISOString();
}

function mapVisit(row, options = {}) {
  const base = {
    id: row.id,
    visitor_name: row.visitor_name,
    visitor_contact: row.visitor_contact || '',
    visitor_from: row.visitor_from || '',
    visitor_photo: row.visitor_photo || null,
    purpose: row.purpose,
    office_id: Number(row.office_id),
    office_name: row.office_name || 'Unknown',
    barcode_card_id: Number(row.barcode_card_id),
    entry_time: row.entry_time,
    exit_time: row.exit_time,
    status: row.status,
  };
  if (options.omitPhoto) {
    const { visitor_photo, ...rest } = base;
    return { ...rest, has_visitor_photo: Boolean(visitor_photo) };
  }
  return base;
}

function mapFailedLoginAlert(row, options = {}) {
  const base = {
    id: row.id,
    attempted_username: row.attempted_username || '',
    snapshot: row.snapshot || null,
    recorded_at: row.recorded_at,
  };
  if (options.omitPhoto) {
    const { snapshot, ...rest } = base;
    return { ...rest, has_snapshot: Boolean(snapshot) };
  }
  return base;
}

function broadcast(event) {
  try {
    const payload = JSON.stringify(event);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        try {
          client.send(payload);
        } catch {
          /* ignore broken clients */
        }
      }
    });
  } catch {
    /* keep HTTP requests safe */
  }
}

function requireDevAdmin(req, res) {
  const auth = String(req.headers.authorization || '').trim();
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || payload.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    req.user = payload;
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

async function generateUniqueSixDigitCardId(client) {
  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const value = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    const check = await client.query('SELECT 1 FROM cards WHERE card_id = $1', [value]);
    if (check.rowCount === 0) return value;
  }
  throw new Error('Unable to generate unique card id');
}

async function ensureDefaultAdmin() {
  const adminsCount = await pool.query('SELECT COUNT(*)::int AS count FROM admins');
  if (adminsCount.rows[0].count === 0) {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
    await pool.query(`
      INSERT INTO admins (username, password_hash, role, active)
      VALUES ($1, $2, 'admin', TRUE)
    `, [DEFAULT_ADMIN_USERNAME, passwordHash]);
    logger.warn({ username: DEFAULT_ADMIN_USERNAME }, 'Seeded default admin user from environment');
  }
}

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const result = await pool.query(`
      SELECT id, username, password_hash, role, active
      FROM admins
      WHERE username = $1
      LIMIT 1
    `, [username]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    if (!user.active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );
    return res.json({
      token,
      user: { username: user.username, role: user.role },
      expires_in: JWT_EXPIRES_IN,
    });
  } catch {
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/admin/accounts', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  try {
    const result = await pool.query(`
      SELECT id, username, role, active, created_at
      FROM admins
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to load admin accounts' });
  }
});

app.post('/api/admin/accounts', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const role = 'admin';
    if (!username) return res.status(400).json({ error: 'Username is required' });
    if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const exists = await pool.query('SELECT 1 FROM admins WHERE LOWER(username) = LOWER($1)', [username]);
    if (exists.rowCount > 0) return res.status(409).json({ error: 'Username already exists' });
    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await pool.query(`
      INSERT INTO admins (username, password_hash, role, active)
      VALUES ($1, $2, $3, TRUE)
      RETURNING id, username, role, active, created_at
    `, [username, passwordHash, role]);
    res.status(201).json(inserted.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

app.patch('/api/admin/accounts/:id/status', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  try {
    const accountId = Number(req.params.id);
    const active = Boolean(req.body?.active);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({ error: 'Invalid account id' });
    }
    if (Number(req.user?.sub) === accountId && !active) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    if (!active) {
      const activeAdmins = await pool.query('SELECT COUNT(*)::int AS count FROM admins WHERE active = TRUE');
      if (activeAdmins.rows[0].count <= 1) {
        return res.status(409).json({ error: 'Cannot deactivate the last active admin' });
      }
    }
    const updated = await pool.query(`
      UPDATE admins
      SET active = $2
      WHERE id = $1
      RETURNING id, username, role, active, created_at
    `, [accountId, active]);
    if (updated.rowCount === 0) return res.status(404).json({ error: 'Account not found' });
    return res.json(updated.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Failed to update account status' });
  }
});

app.delete('/api/admin/accounts/:id', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  try {
    const accountId = Number(req.params.id);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({ error: 'Invalid account id' });
    }
    if (Number(req.user?.sub) === accountId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const activeAdmins = await pool.query('SELECT COUNT(*)::int AS count FROM admins WHERE active = TRUE');
    const target = await pool.query('SELECT id, active FROM admins WHERE id = $1', [accountId]);
    if (target.rowCount === 0) return res.status(404).json({ error: 'Account not found' });
    if (target.rows[0].active && activeAdmins.rows[0].count <= 1) {
      return res.status(409).json({ error: 'Cannot delete the last active admin' });
    }
    await pool.query('DELETE FROM admins WHERE id = $1', [accountId]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

app.post('/api/auth/failed-login-report', failedReportLimiter, async (req, res) => {
  try {
    const { attempted_username, snapshot } = req.body || {};
    let photo = null;
    if (typeof snapshot === 'string' && snapshot.startsWith('data:image/')) {
      photo = snapshot.length > 6_000_000 ? null : snapshot;
    }
    const inserted = await pool.query(`
      INSERT INTO failed_login_alerts (attempted_username, snapshot)
      VALUES ($1, $2)
      RETURNING id, attempted_username, snapshot, recorded_at
    `, [
      attempted_username != null ? String(attempted_username) : '',
      photo,
    ]);
    const alert = mapFailedLoginAlert(inserted.rows[0]);
    broadcast({ type: 'failed_login_alert', alert: mapFailedLoginAlert(inserted.rows[0], { omitPhoto: true }) });
    res.status(201).json({ id: alert.id, recorded_at: alert.recorded_at });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record sign-in alert' });
  }
});

app.get('/api/auth/failed-login-alerts', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const result = await pool.query(`
      SELECT id, attempted_username, snapshot, recorded_at
      FROM failed_login_alerts
      ORDER BY id DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows.map((r) => mapFailedLoginAlert(r)));
  } catch {
    res.status(500).json({ error: 'Failed to load sign-in alerts' });
  }
});

app.delete('/api/auth/failed-login-alerts/:id', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid alert id' });
    }
    const deleted = await pool.query('DELETE FROM failed_login_alerts WHERE id = $1 RETURNING id', [id]);
    if (deleted.rowCount === 0) return res.status(404).json({ error: 'Alert not found' });
    broadcast({ type: 'failed_login_alert_deleted', id });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Failed to delete sign-in alert' });
  }
});

app.get('/api/offices', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, active, notification_email, email_notifications_enabled
      FROM offices
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to load offices' });
  }
});

app.post('/api/offices', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  try {
    const { name, notification_email, email_notifications_enabled } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Office name is required' });
    const result = await pool.query(`
      INSERT INTO offices (name, active, notification_email, email_notifications_enabled)
      VALUES ($1, TRUE, $2, $3)
      RETURNING id, name, active, notification_email, email_notifications_enabled
    `, [name.trim(), notification_email || '', Boolean(email_notifications_enabled)]);
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to create office' });
  }
});

app.patch('/api/offices/:id', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  try {
    const officeId = Number(req.params.id);
    const { name, notification_email, email_notifications_enabled, active } = req.body || {};
    const existing = await pool.query('SELECT * FROM offices WHERE id = $1', [officeId]);
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Office not found' });
    const row = existing.rows[0];
    const updated = await pool.query(`
      UPDATE offices
      SET name = $2, notification_email = $3, email_notifications_enabled = $4, active = $5
      WHERE id = $1
      RETURNING id, name, active, notification_email, email_notifications_enabled
    `, [
      officeId,
      typeof name === 'string' ? (name.trim() || row.name) : row.name,
      typeof notification_email === 'string' ? notification_email : row.notification_email,
      typeof email_notifications_enabled === 'boolean' ? email_notifications_enabled : row.email_notifications_enabled,
      typeof active === 'boolean' ? active : row.active,
    ]);
    res.json(updated.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update office' });
  }
});

app.get('/api/cards', async (_req, res) => {
  if (!requireDevAdmin(_req, res)) return;
  try {
    const result = await pool.query('SELECT id, card_id, card_name, created_at FROM cards ORDER BY id DESC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to load cards' });
  }
});

app.post('/api/cards/generate', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  const client = await pool.connect();
  try {
    const cardName = String(req.body?.card_name || 'Visitor').trim() || 'Visitor';
    const requestedCount = Number(req.body?.count || 1);
    const count = Number.isFinite(requestedCount) ? Math.max(1, Math.min(200, Math.floor(requestedCount))) : 1;
    await client.query('BEGIN');
    const generated = [];
    for (let i = 0; i < count; i += 1) {
      const cardId = await generateUniqueSixDigitCardId(client);
      const inserted = await client.query(`
        INSERT INTO cards (card_id, card_name)
        VALUES ($1, $2)
        RETURNING id, card_id, card_name, created_at
      `, [cardId, cardName]);
      generated.push(inserted.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json({ generated, count: generated.length });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to generate cards' });
  } finally {
    client.release();
  }
});

app.delete('/api/cards/:id', async (req, res) => {
  if (!requireDevAdmin(req, res)) return;
  try {
    const cardId = Number(req.params.id);
    const card = await pool.query('SELECT id FROM cards WHERE id = $1', [cardId]);
    if (card.rowCount === 0) return res.status(404).json({ error: 'Card not found' });
    const inUse = await pool.query("SELECT 1 FROM visits WHERE barcode_card_id = $1 AND status = 'active' LIMIT 1", [cardId]);
    if (inUse.rowCount > 0) return res.status(409).json({ error: 'Card has active visit and cannot be deleted' });
    await pool.query('DELETE FROM cards WHERE id = $1', [cardId]);
    return res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

app.get('/api/cards/lookup/:barcode', async (req, res) => {
  try {
    const barcode = String(req.params.barcode || '').trim();
    const cardResult = await pool.query('SELECT id, card_id, card_name, created_at FROM cards WHERE card_id = $1', [barcode]);
    if (cardResult.rowCount === 0) {
      return res.status(404).json({ error: 'Card not found in system. Use a registered card.' });
    }
    const visitResult = await pool.query(`
      SELECT v.*, o.name AS office_name
      FROM visits v
      LEFT JOIN offices o ON o.id = v.office_id
      WHERE v.barcode_card_id = $1 AND v.status = 'active'
      ORDER BY v.id DESC
      LIMIT 1
    `, [cardResult.rows[0].id]);
    res.json({
      card: cardResult.rows[0],
      currentVisit: visitResult.rowCount ? mapVisit(visitResult.rows[0]) : null,
    });
  } catch {
    res.status(500).json({ error: 'Failed to lookup card' });
  }
});

app.post('/api/visits', async (req, res) => {
  try {
    const { visitor_name, visitor_contact, visitor_from, visitor_photo, purpose, office_id, barcode_card_id } = req.body || {};
    if (!visitor_name || !purpose || !office_id || !barcode_card_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    let photo = null;
    if (typeof visitor_photo === 'string' && visitor_photo.startsWith('data:image/')) {
      photo = visitor_photo.length > 6_000_000 ? null : visitor_photo;
    }
    const inserted = await pool.query(`
      INSERT INTO visits (
        visitor_name, visitor_contact, visitor_from, visitor_photo, purpose, office_id, barcode_card_id, entry_time, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'active')
      RETURNING *
    `, [
      String(visitor_name),
      visitor_contact || '',
      visitor_from ? String(visitor_from).trim() : '',
      photo,
      String(purpose),
      Number(office_id),
      Number(barcode_card_id),
    ]);
    const withOffice = await pool.query(`
      SELECT v.*, o.name AS office_name
      FROM visits v
      LEFT JOIN offices o ON o.id = v.office_id
      WHERE v.id = $1
    `, [inserted.rows[0].id]);
    const view = mapVisit(withOffice.rows[0]);
    broadcast({ type: 'visit_created', visit: mapVisit(withOffice.rows[0], { omitPhoto: true }) });
    res.status(201).json(view);
  } catch {
    res.status(500).json({ error: 'Failed to register visit' });
  }
});

app.post('/api/visits/scan-out', async (req, res) => {
  try {
    const normalizedCardId = String(req.body?.card_id || '').trim();
    const card = await pool.query('SELECT id FROM cards WHERE card_id = $1', [normalizedCardId]);
    if (card.rowCount === 0) return res.status(404).json({ error: 'Card not found' });
    const updated = await pool.query(`
      UPDATE visits
      SET status = 'completed', exit_time = NOW()
      WHERE id = (
        SELECT id FROM visits
        WHERE barcode_card_id = $1 AND status = 'active'
        ORDER BY id DESC
        LIMIT 1
      )
      RETURNING *
    `, [card.rows[0].id]);
    if (updated.rowCount === 0) return res.status(404).json({ error: 'No active visit for card' });
    const withOffice = await pool.query(`
      SELECT v.*, o.name AS office_name
      FROM visits v
      LEFT JOIN offices o ON o.id = v.office_id
      WHERE v.id = $1
    `, [updated.rows[0].id]);
    const view = mapVisit(withOffice.rows[0]);
    broadcast({ type: 'visit_completed', visit: mapVisit(withOffice.rows[0], { omitPhoto: true }) });
    res.json(view);
  } catch {
    res.status(500).json({ error: 'Failed to scan out visit' });
  }
});

app.get('/api/visits', async (req, res) => {
  try {
    const { office_id, status, active_only, from_date, to_date, limit, omit_photos } = req.query;
    const where = [];
    const values = [];
    let idx = 1;
    if (office_id) {
      where.push(`v.office_id = $${idx++}`);
      values.push(Number(office_id));
    }
    if (status) {
      where.push(`v.status = $${idx++}`);
      values.push(String(status));
    }
    if (active_only === 'true') {
      where.push(`v.status = 'active'`);
    }
    if (from_date) {
      where.push(`v.entry_time >= $${idx++}`);
      values.push(new Date(`${from_date}T00:00:00`).toISOString());
    }
    if (to_date) {
      where.push(`v.entry_time <= $${idx++}`);
      values.push(new Date(`${to_date}T23:59:59`).toISOString());
    }
    const max = Number(limit) || 200;
    values.push(Math.min(max, 1000));
    const query = `
      SELECT v.*, o.name AS office_name
      FROM visits v
      LEFT JOIN offices o ON o.id = v.office_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY v.id DESC
      LIMIT $${idx}
    `;
    const rows = await pool.query(query, values);
    const slim = omit_photos === 'true';
    res.json(rows.rows.map((r) => mapVisit(r, { omitPhoto: slim })));
  } catch {
    res.status(500).json({ error: 'Failed to load visits' });
  }
});

app.post('/api/scan-sessions', (req, res) => {
  const { mode } = req.body || {};
  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    mode: mode === 'scanOut' ? 'scanOut' : 'register',
    status: 'waiting',
    barcode: null,
    error: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  scanSessions.set(sessionId, session);
  res.status(201).json(session);
});

app.get('/api/scan-sessions/:id', (req, res) => {
  const session = scanSessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Scan session not found' });
  res.json(session);
});

app.post('/api/scan-sessions/:id/scan', async (req, res) => {
  const session = scanSessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Scan session not found' });
  const barcode = String(req.body?.barcode || '').trim();
  if (!barcode) return res.status(400).json({ error: 'Barcode is required' });
  try {
    const card = await pool.query('SELECT id FROM cards WHERE card_id = $1', [barcode]);
    if (card.rowCount === 0) {
      session.status = 'rejected';
      session.error = 'Card not in system';
      session.barcode = barcode;
      session.updated_at = nowIso();
      return res.status(422).json({ error: 'Card not in system' });
    }
    session.status = 'scanned';
    session.error = null;
    session.barcode = barcode;
    session.updated_at = nowIso();
    res.json({ ok: true, barcode });
  } catch {
    res.status(500).json({ error: 'Failed to process scan' });
  }
});

app.use((err, req, res, _next) => {
  if (SENTRY_DSN) Sentry.captureException(err);
  req.log?.error({ err }, 'Unhandled request error');
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', () => {});

ensureDefaultAdmin().then(() => {
  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'SCIS Gate System backend running');
  });
}).catch((error) => {
  if (SENTRY_DSN) Sentry.captureException(error);
  logger.error({ err: error }, 'Failed to initialize backend');
  process.exit(1);
});
