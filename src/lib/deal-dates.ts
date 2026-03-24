const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toDateOnlyValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateOnlyValue(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function parseDealDate(value: string, endOfDay: boolean): Date | null {
  const parsed = DATE_ONLY_PATTERN.test(value)
    ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
    : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toComparableDateKey(value: string | Date): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return toDateOnlyValue(value);
  }

  if (DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateOnlyValue(parsed);
}

export function isDealStartBeforeToday(
  value: string | Date,
  now: Date = new Date()
): boolean {
  return isDealDateBeforeToday(value, now);
}

export function isDealDateBeforeToday(
  value: string | Date,
  now: Date = new Date()
): boolean {
  const startKey = toComparableDateKey(value);
  if (!startKey) return false;
  // Use UTC-12 (westernmost timezone) so a date is only rejected if it's
  // in the past everywhere on earth. Prevents server UTC clock from
  // rejecting "today" picks from users in western timezones (e.g. US).
  const utcMinus12 = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const todayKey = [
    utcMinus12.getUTCFullYear(),
    String(utcMinus12.getUTCMonth() + 1).padStart(2, '0'),
    String(utcMinus12.getUTCDate()).padStart(2, '0'),
  ].join('-');
  return startKey < todayKey;
}

export function isDealEndSameOrBeforeStart(
  startsAt: string | Date,
  expiresAt: string | Date
): boolean {
  const startKey = toComparableDateKey(startsAt);
  const endKey = toComparableDateKey(expiresAt);
  if (!startKey || !endKey) return false;
  return endKey <= startKey;
}
