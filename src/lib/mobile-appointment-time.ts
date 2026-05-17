import { localToUTC } from '@/lib/timezone';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function resolveMobileAppointmentStartTime({
  startTime,
  startDate,
  startTimeLocal,
  timezone,
}: {
  startTime?: unknown;
  startDate?: unknown;
  startTimeLocal?: unknown;
  timezone: string;
}): Date | null {
  if (
    typeof startDate === 'string' &&
    DATE_KEY_PATTERN.test(startDate) &&
    typeof startTimeLocal === 'string' &&
    TIME_VALUE_PATTERN.test(startTimeLocal)
  ) {
    const [hours, minutes] = startTimeLocal.split(':').map(Number);
    return localToUTC(startDate, hours, minutes, timezone);
  }

  if (typeof startTime === 'string' || startTime instanceof Date) {
    const parsed = new Date(startTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}
