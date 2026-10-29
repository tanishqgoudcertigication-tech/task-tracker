/**
 * Returns today's date in YYYY-MM-DD format according to IST (Asia/Kolkata).
 */
export function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/**
 * Returns a human-friendly date string for the provided YYYY-MM-DD date.
 */
export function formatISTDisplayDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Generates an array of 365 consecutive YYYY-MM-DD dates starting from startDateStr.
 */
export function generate365Days(startDateStr: string): string[] {
  const [year, month, day] = startDateStr.split('-').map(Number);
  const result: string[] = [];

  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.UTC(year, month - 1, day + i));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dt = String(d.getUTCDate()).padStart(2, '0');
    result.push(`${y}-${m}-${dt}`);
  }

  return result;
}

/**
 * Calculates days elapsed between startDateStr and todayStr (inclusive).
 */
export function getDaysElapsed(startDateStr: string, todayStr: string): number {
  if (startDateStr > todayStr) return 0;
  const [y1, m1, d1] = startDateStr.split('-').map(Number);
  const [y2, m2, d2] = todayStr.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const diffDays = Math.round((t2 - t1) / (24 * 60 * 60 * 1000));
  return Math.max(1, diffDays + 1);
}

/**
 * Formats a month and year header (e.g. "October 2026").
 */
export function formatMonthYear(year: number, monthIndex: number): string {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Returns all days in a given year and 1-based month.
 */
export function getMonthDays(
  year: number,
  month: number
): { date: string; dayNum: number; dayOfWeek: string }[] {
  const days: { date: string; dayNum: number; dayOfWeek: string }[] = [];
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= count; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = new Date(Date.UTC(year, month - 1, d));
    const dayOfWeek = new Intl.DateTimeFormat('en-IN', {
      weekday: 'narrow',
      timeZone: 'UTC',
    }).format(dt);
    days.push({ date: dateStr, dayNum: d, dayOfWeek });
  }
  return days;
}
