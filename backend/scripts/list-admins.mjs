import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query('SELECT id, username, active, created_at FROM admins ORDER BY id');
if (result.rowCount === 0) {
  console.log('No admin accounts in database.');
} else {
  console.log('Admin accounts:');
  for (const row of result.rows) {
    console.log(`  - id=${row.id} username="${row.username}" active=${row.active}`);
  }
}
await pool.end();
