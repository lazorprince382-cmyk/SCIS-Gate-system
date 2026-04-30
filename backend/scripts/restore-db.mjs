import 'dotenv/config';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const DATABASE_URL = process.env.DATABASE_URL;
const backupFile = process.argv[2];

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}
if (!backupFile) {
  console.error('Usage: npm run restore:db -- <backup-file.sql>');
  process.exit(1);
}
if (!fs.existsSync(backupFile)) {
  console.error(`Backup file not found: ${backupFile}`);
  process.exit(1);
}

const child = spawn('psql', ['--dbname', DATABASE_URL, '--file', backupFile], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
