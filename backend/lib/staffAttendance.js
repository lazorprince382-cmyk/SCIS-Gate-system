const SCHOOL_TZ = process.env.SCHOOL_TZ || 'Africa/Kampala';
const REPORT_HOUR = Number(process.env.STAFF_REPORT_HOUR ?? 7);
const REPORT_MINUTE = Number(process.env.STAFF_REPORT_MINUTE ?? 0);
const GRACE_MINUTES = Number(process.env.STAFF_GRACE_MINUTES ?? 0);

function tzParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function schoolDateFromInstant(instant = new Date()) {
  return tzParts(instant, SCHOOL_TZ).date;
}

export function minutesSinceMidnight(instant = new Date()) {
  const p = tzParts(instant, SCHOOL_TZ);
  return p.hour * 60 + p.minute;
}

export function reportDeadlineMinutes() {
  return REPORT_HOUR * 60 + REPORT_MINUTE;
}

export function contractMinutesPerMonth(staff) {
  const days = Number(staff.work_days_per_month) || 22;
  const hours = Number(staff.hours_per_day) || 8;
  return Math.max(1, Math.round(days * hours * 60));
}

export function dailySalary(staff) {
  const salary = Number(staff.monthly_salary) || 0;
  const days = Number(staff.work_days_per_month) || 22;
  if (days <= 0) return 0;
  return salary / days;
}

export function minuteRate(staff) {
  const salary = Number(staff.monthly_salary) || 0;
  const mins = contractMinutesPerMonth(staff);
  if (mins <= 0) return 0;
  return salary / mins;
}

export function calcLateMinutes(checkInInstant) {
  const mins = minutesSinceMidnight(checkInInstant);
  const deadline = reportDeadlineMinutes() + GRACE_MINUTES;
  const late = mins - deadline;
  return late > 0 ? late : 0;
}

export function calcLateDeduction(staff, lateMinutes) {
  if (!lateMinutes || lateMinutes <= 0) return 0;
  return Math.round(minuteRate(staff) * lateMinutes * 100) / 100;
}

export function calcAbsentDeduction(staff) {
  return Math.round(dailySalary(staff) * 100) / 100;
}

export function evaluateCheckIn(staff, checkInInstant) {
  const lateMinutes = calcLateMinutes(checkInInstant);
  const deduction = calcLateDeduction(staff, lateMinutes);
  return {
    status: lateMinutes > 0 ? 'late' : 'on_time',
    late_minutes: lateMinutes,
    deduction_amount: deduction,
  };
}

export function formatReportTime() {
  const h = String(REPORT_HOUR).padStart(2, '0');
  const m = String(REPORT_MINUTE).padStart(2, '0');
  return `${h}:${m}`;
}

export function staffSettings() {
  return {
    school_tz: SCHOOL_TZ,
    report_time: formatReportTime(),
    grace_minutes: GRACE_MINUTES,
  };
}
