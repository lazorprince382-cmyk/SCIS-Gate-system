/* eslint-disable camelcase */
export const shorthands = undefined;

export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS staff (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
      work_days_per_month INTEGER NOT NULL DEFAULT 22,
      hours_per_day NUMERIC(4, 2) NOT NULL DEFAULT 8,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS staff_cards (
      id SERIAL PRIMARY KEY,
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      card_id VARCHAR(6) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS staff_attendance (
      id SERIAL PRIMARY KEY,
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      school_date DATE NOT NULL,
      check_in_at TIMESTAMPTZ,
      check_out_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'present',
      late_minutes INTEGER NOT NULL DEFAULT 0,
      deduction_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      excuse_type TEXT,
      excuse_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (staff_id, school_date)
    );
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_staff_attendance_date
    ON staff_attendance (school_date);
  `);
}

export async function down(pgm) {
  pgm.sql('DROP INDEX IF EXISTS idx_staff_attendance_date;');
  pgm.sql('DROP TABLE IF EXISTS staff_attendance;');
  pgm.sql('DROP TABLE IF EXISTS staff_cards;');
  pgm.sql('DROP TABLE IF EXISTS staff;');
}
