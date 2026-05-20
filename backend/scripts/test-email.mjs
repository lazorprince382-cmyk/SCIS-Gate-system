import 'dotenv/config';
import { sendVisitorArrivalEmail, isMailConfigured } from '../lib/mailer.js';
import pino from 'pino';

const logger = pino({ level: 'info' });
const to = process.argv[2] || process.env.SMTP_USER;

if (!isMailConfigured()) {
  console.error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  process.exit(1);
}

const office = {
  name: 'Principal Office',
  notification_email: to,
  email_notifications_enabled: true,
};

const visit = {
  visitor_name: 'Test Visitor',
  visitor_contact: '0700000000',
  visitor_from: 'Gate system test',
  purpose: 'Email configuration test',
  entry_time: new Date().toISOString(),
};

try {
  const result = await sendVisitorArrivalEmail(office, visit, logger);
  console.log('Result:', result);
} catch (err) {
  console.error('Send failed:', err.message);
  process.exit(1);
}
