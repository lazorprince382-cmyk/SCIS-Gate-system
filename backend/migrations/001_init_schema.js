/* eslint-disable camelcase */
export const shorthands = undefined;

export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS offices (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      notification_email TEXT NOT NULL DEFAULT '',
      email_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS cards (
      id SERIAL PRIMARY KEY,
      card_id VARCHAR(6) NOT NULL UNIQUE,
      card_name TEXT NOT NULL DEFAULT 'Visitor',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      visitor_name TEXT NOT NULL,
      visitor_contact TEXT NOT NULL DEFAULT '',
      visitor_from TEXT NOT NULL DEFAULT '',
      visitor_photo TEXT,
      purpose TEXT NOT NULL,
      office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE RESTRICT,
      barcode_card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
      entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      exit_time TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'active'
    );
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS failed_login_alerts (
      id SERIAL PRIMARY KEY,
      attempted_username TEXT NOT NULL DEFAULT '',
      snapshot TEXT,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql('ALTER TABLE failed_login_alerts DROP COLUMN IF EXISTS attempted_password;');
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_visits_card_active
    ON visits (barcode_card_id)
    WHERE status = 'active';
  `);

  pgm.sql(`
    INSERT INTO offices (name, active, notification_email, email_notifications_enabled)
    VALUES
      ('Principal Office', TRUE, '', FALSE),
      ('Accounts Office', TRUE, '', FALSE)
    ON CONFLICT DO NOTHING;
  `);

  pgm.sql(`
    INSERT INTO cards (card_id, card_name)
    VALUES
      ('100001', 'Visitor'),
      ('100002', 'Visitor'),
      ('100003', 'Visitor')
    ON CONFLICT (card_id) DO NOTHING;
  `);
}

export async function down(pgm) {
  pgm.sql('DROP INDEX IF EXISTS idx_visits_card_active;');
  pgm.sql('DROP TABLE IF EXISTS failed_login_alerts;');
  pgm.sql('DROP TABLE IF EXISTS visits;');
  pgm.sql('DROP TABLE IF EXISTS cards;');
  pgm.sql('DROP TABLE IF EXISTS offices;');
  pgm.sql('DROP TABLE IF EXISTS admins;');
}
