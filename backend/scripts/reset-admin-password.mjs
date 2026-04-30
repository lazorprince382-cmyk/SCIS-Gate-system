import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}
if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD is required in env.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const run = async () => {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const result = await pool.query(
    'UPDATE admins SET password_hash = $2, active = TRUE WHERE username = $1 RETURNING id, username',
    [ADMIN_USERNAME, hash],
  );
  if (result.rowCount === 0) {
    console.error(`Admin user not found: ${ADMIN_USERNAME}`);
    process.exit(1);
  }
  console.log(`Password reset for admin: ${result.rows[0].username}`);
};

run()
  .finally(async () => {
    await pool.end();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
