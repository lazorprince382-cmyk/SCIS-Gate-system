import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'noreply@scis-gate.local';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

let transporter;

export function isMailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE || SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

function formatEntryTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: process.env.SCHOOL_TZ || 'Africa/Kampala',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

function buildVisitorEmail(office, visit) {
  const officeName = office.name || 'Office';
  const visitorName = visit.visitor_name || 'Visitor';
  const subject = `Visitor on the way to ${officeName}: ${visitorName}`;
  const entryTime = formatEntryTime(visit.entry_time);
  const rows = [
    ['Visitor name', visitorName],
    ['Contact', visit.visitor_contact || '—'],
    ['Coming from', visit.visitor_from || '—'],
    ['Purpose', visit.purpose || '—'],
    ['Visiting office', officeName],
    ['Registered at', entryTime],
    ['Status', 'On the way (checked in at gate)'],
  ];

  const text = [
    `A visitor has registered at the gate and is heading to ${officeName}.`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    '— SCIS Gate System',
  ].join('\n');

  const tableRows = rows
    .map(
      ([label, value]) => `<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:600;color:#1e3a5f;">${label}</td><td style="padding:8px 12px;border:1px solid #ddd;">${escapeHtml(String(value))}</td></tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;color:#222;">
      <h2 style="color:#1e3a5f;margin:0 0 12px;">Incoming visitor</h2>
      <p style="margin:0 0 16px;">A visitor has registered at the gate and is heading to <strong>${escapeHtml(officeName)}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;font-size:15px;">${tableRows}</table>
      <p style="margin:16px 0 0;font-size:12px;color:#666;">SCIS Gate System — automatic notification</p>
    </div>
  `;

  return { subject, text, html };
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} office - row with name, notification_email, email_notifications_enabled
 * @param {object} visit - mapped visit (visitor_name, contact, etc.)
 * @param {import('pino').Logger} [logger]
 */
export async function sendVisitorArrivalEmail(office, visit, logger) {
  const to = String(office.notification_email || '').trim();
  if (!office.email_notifications_enabled || !to) {
    return { sent: false, reason: 'notifications_disabled' };
  }
  const transport = getTransporter();
  if (!transport) {
    logger?.warn('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS); visitor email skipped');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const { subject, text, html } = buildVisitorEmail(office, visit);
  await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
  logger?.info({ to, office: office.name, visitor: visit.visitor_name }, 'Visitor notification email sent');
  return { sent: true, to };
}
