import { describeBusinessClosure, findBusinessClosureForDate, type BusinessClosureDateValue } from '@/lib/business-closures';
import { formatScheduleTimeLabel, normalizeBusinessHoursRecord } from '@/lib/staff-schedule';
import { dateKeyInTimeZone, localToUTC, weekdayIndexInTimeZone } from '@/lib/timezone';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type BusinessHoursValidationError = {
  error: string;
  status: 400;
  reason: 'business_closed';
};

export function validateBusinessHoursForAppointment({
  startTime,
  endTime,
  timezone,
  businessHours,
  closureDates,
}: {
  startTime: Date;
  endTime: Date;
  timezone: string;
  businessHours?: unknown;
  closureDates?: BusinessClosureDateValue[] | null;
}): BusinessHoursValidationError | null {
  if (!businessHours) {
    return {
      error: 'Business hours are not configured yet.',
      status: 400,
      reason: 'business_closed',
    };
  }

  const dateKey = dateKeyInTimeZone(startTime, timezone);
  const closure = findBusinessClosureForDate(dateKey, closureDates);

  if (closure) {
    return {
      error: describeBusinessClosure(closure),
      status: 400,
      reason: 'business_closed',
    };
  }

  const dayOfWeek = weekdayIndexInTimeZone(startTime, timezone);
  const hoursRecord = normalizeBusinessHoursRecord(businessHours);
  const dayHours = hoursRecord[dayOfWeek];

  if (!dayHours?.isOpen || !dayHours.openTime || !dayHours.closeTime) {
    return {
      error: 'This business is closed on that day.',
      status: 400,
      reason: 'business_closed',
    };
  }

  const openAt = localToUTC(
    dateKey,
    Number.parseInt(dayHours.openTime.slice(0, 2), 10),
    Number.parseInt(dayHours.openTime.slice(3, 5), 10),
    timezone
  );
  const closeAt = localToUTC(
    dateKey,
    Number.parseInt(dayHours.closeTime.slice(0, 2), 10),
    Number.parseInt(dayHours.closeTime.slice(3, 5), 10),
    timezone
  );

  if (startTime < openAt || endTime > closeAt) {
    return {
      error: `This business is open ${WEEKDAY_LABELS[dayOfWeek]} from ${formatScheduleTimeLabel(dayHours.openTime)} to ${formatScheduleTimeLabel(dayHours.closeTime)}.`,
      status: 400,
      reason: 'business_closed',
    };
  }

  return null;
}
