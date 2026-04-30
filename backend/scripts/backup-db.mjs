import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const outDir = process.env.DB_BACKUP_DIR || path.resolve(process.cwd(), 'backups');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const filePath = path.join(outDir, `gate-backup-${stamp}.sql`);

const child = spawn('pg_dump', ['--no-owner', '--no-privileges', '--dbname', DATABASE_URL, '--file', filePath], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log(`Backup saved: ${filePath}`);
    process.exit(0);
  }
  process.exit(code ?? 1);
});
