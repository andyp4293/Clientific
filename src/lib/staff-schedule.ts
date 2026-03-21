import { localToUTC, weekdayIndexInTimeZone } from '@/lib/timezone';

export type BusinessDayHours = {
  isOpen?: boolean;
  openTime?: string | null;
  closeTime?: string | null;
};

export type BusinessHoursRecord = Partial<Record<number, BusinessDayHours>>;

export type StaffDayHours = {
  startTime: string;
  endTime: string;
};

export type StaffWorkHoursRecord = Partial<Record<number, StaffDayHours>>;

export type EffectiveStaffDayHours = {
  worksDay: boolean;
  startTime: string | null;
  endTime: string | null;
  source: 'business' | 'custom' | 'unavailable';
};

const VALID_DAY_INDEXES = new Set([0, 1, 2, 3, 4, 5, 6]);

export function getDefaultBusinessHoursRecord(): BusinessHoursRecord {
  return {
    0: { isOpen: false, openTime: null, closeTime: null },
    1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    3: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    4: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    5: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    6: { isOpen: false, openTime: null, closeTime: null },
  };
}

export function normalizeBusinessHoursRecord(rawHours: unknown): BusinessHoursRecord {
  const fallback = getDefaultBusinessHoursRecord();
  if (!rawHours || typeof rawHours !== 'object') return fallback;

  const record: BusinessHoursRecord = {};

  for (const [rawDay, rawValue] of Object.entries(rawHours as Record<string, unknown>)) {
    const dayIndex = Number.parseInt(rawDay, 10);
    if (!VALID_DAY_INDEXES.has(dayIndex)) continue;
    if (!rawValue || typeof rawValue !== 'object') continue;

    const value = rawValue as Record<string, unknown>;
    record[dayIndex] = {
      isOpen: Boolean(value.isOpen),
      openTime: typeof value.openTime === 'string' ? value.openTime : null,
      closeTime: typeof value.closeTime === 'string' ? value.closeTime : null,
    };
  }

  return { ...fallback, ...record };
}

export function normalizeStaffWorkHours(rawHours: unknown): StaffWorkHoursRecord {
  if (!rawHours || typeof rawHours !== 'object') return {};

  const record: StaffWorkHoursRecord = {};

  for (const [rawDay, rawValue] of Object.entries(rawHours as Record<string, unknown>)) {
    const dayIndex = Number.parseInt(rawDay, 10);
    if (!VALID_DAY_INDEXES.has(dayIndex)) continue;
    if (!rawValue || typeof rawValue !== 'object') continue;

    const value = rawValue as Record<string, unknown>;
    const startTime = typeof value.startTime === 'string' ? value.startTime : null;
    const endTime = typeof value.endTime === 'string' ? value.endTime : null;

    if (!startTime || !endTime) continue;
    if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) continue;
    if (compareTimeStrings(startTime, endTime) >= 0) continue;

    record[dayIndex] = { startTime, endTime };
  }

  return record;
}

export function normalizeWorkDays(rawDays: unknown): number[] {
  if (!Array.isArray(rawDays)) return [];

  return Array.from(
    new Set(
      rawDays.filter(
        (value): value is number =>
          typeof value === 'number' && Number.isInteger(value) && VALID_DAY_INDEXES.has(value)
      )
    )
  ).sort((a, b) => a - b);
}

export function isValidTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export function timeStringToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function compareTimeStrings(a: string, b: string): number {
  return timeStringToMinutes(a) - timeStringToMinutes(b);
}

export function maxTimeString(a: string, b: string): string {
  return compareTimeStrings(a, b) >= 0 ? a : b;
}

export function minTimeString(a: string, b: string): string {
  return compareTimeStrings(a, b) <= 0 ? a : b;
}

export function addMinutesToTimeString(value: string, minutesToAdd: number): string {
  const total = timeStringToMinutes(value) + minutesToAdd;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function buildTimeOptions(
  startTime: string,
  endTime: string,
  options?: { includeEnd?: boolean; stepMinutes?: number }
): string[] {
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) return [];

  const includeEnd = options?.includeEnd ?? false;
  const stepMinutes = options?.stepMinutes ?? 30;
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  if (startMinutes >= endMinutes || stepMinutes <= 0) return [];

  const times: string[] = [];
  for (let minutes = startMinutes; includeEnd ? minutes <= endMinutes : minutes < endMinutes; minutes += stepMinutes) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    times.push(`${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`);
  }

  return times;
}

export function buildAppointmentStartOptions(
  startTime: string,
  endTime: string,
  durationMinutes: number,
  stepMinutes = 30
): string[] {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return [];
  const lastPossibleStart = addMinutesToTimeString(endTime, -durationMinutes);
  if (compareTimeStrings(startTime, lastPossibleStart) > 0) return [];
  return buildTimeOptions(startTime, addMinutesToTimeString(lastPossibleStart, stepMinutes), {
    includeEnd: false,
    stepMinutes,
  });
}

export function getEffectiveStaffDayHours({
  workDays,
  workHours,
  businessHours,
  dayOfWeek,
}: {
  workDays: number[];
  workHours?: unknown;
  businessHours?: unknown;
  dayOfWeek: number;
}): EffectiveStaffDayHours {
  const normalizedWorkDays = normalizeWorkDays(workDays);
  if (!normalizedWorkDays.includes(dayOfWeek)) {
    return { worksDay: false, startTime: null, endTime: null, source: 'unavailable' };
  }

  const businessHoursRecord = normalizeBusinessHoursRecord(businessHours);
  const businessDay = businessHoursRecord[dayOfWeek];
  if (!businessDay?.isOpen || !businessDay.openTime || !businessDay.closeTime) {
    return { worksDay: true, startTime: null, endTime: null, source: 'unavailable' };
  }

  const normalizedWorkHours = normalizeStaffWorkHours(workHours);
  const customHours = normalizedWorkHours[dayOfWeek];

  if (customHours) {
    const startTime = maxTimeString(customHours.startTime, businessDay.openTime);
    const endTime = minTimeString(customHours.endTime, businessDay.closeTime);
    if (compareTimeStrings(startTime, endTime) < 0) {
      return { worksDay: true, startTime, endTime, source: 'custom' };
    }
    return { worksDay: true, startTime: null, endTime: null, source: 'unavailable' };
  }

  return {
    worksDay: true,
    startTime: businessDay.openTime,
    endTime: businessDay.closeTime,
    source: 'business',
  };
}

export function formatScheduleTimeLabel(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hourLabel = hours % 12 === 0 ? 12 : hours % 12;
  return `${hourLabel}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatStaffAvailabilitySummary({
  workDays,
  workHours,
  businessHours,
  weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}: {
  workDays: number[];
  workHours?: unknown;
  businessHours?: unknown;
  weekdayLabels?: string[];
}): string {
  const parts: string[] = [];

  for (let dayOfWeek = 0; dayOfWeek < weekdayLabels.length; dayOfWeek += 1) {
    const schedule = getEffectiveStaffDayHours({
      workDays,
      workHours,
      businessHours,
      dayOfWeek,
    });

    if (!schedule.worksDay) {
      parts.push(`${weekdayLabels[dayOfWeek]} off`);
      continue;
    }

    if (!schedule.startTime || !schedule.endTime) {
      parts.push(`${weekdayLabels[dayOfWeek]} unavailable`);
      continue;
    }

    parts.push(
      `${weekdayLabels[dayOfWeek]} ${formatScheduleTimeLabel(schedule.startTime)}-${formatScheduleTimeLabel(schedule.endTime)}`
    );
  }

  return parts.join('; ');
}

export function sanitizeStaffWorkHoursForSave({
  workDays,
  workHours,
  businessHours,
}: {
  workDays: number[];
  workHours?: unknown;
  businessHours?: unknown;
}): StaffWorkHoursRecord {
  const normalizedWorkDays = normalizeWorkDays(workDays);
  const businessHoursRecord = normalizeBusinessHoursRecord(businessHours);
  const normalizedWorkHours = normalizeStaffWorkHours(workHours);
  const sanitized: StaffWorkHoursRecord = {};

  for (const dayOfWeek of normalizedWorkDays) {
    const businessDay = businessHoursRecord[dayOfWeek];
    if (!businessDay?.isOpen || !businessDay.openTime || !businessDay.closeTime) continue;

    const customHours = normalizedWorkHours[dayOfWeek];
    if (!customHours) continue;

    const startTime = maxTimeString(customHours.startTime, businessDay.openTime);
    const endTime = minTimeString(customHours.endTime, businessDay.closeTime);
    if (compareTimeStrings(startTime, endTime) >= 0) continue;

    if (startTime === businessDay.openTime && endTime === businessDay.closeTime) continue;

    sanitized[dayOfWeek] = { startTime, endTime };
  }

  return sanitized;
}

export function formatStaffDayWindow({
  dayOfWeek,
  workDays,
  workHours,
  businessHours,
  weekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}: {
  dayOfWeek: number;
  workDays: number[];
  workHours?: unknown;
  businessHours?: unknown;
  weekdayLabels?: string[];
}): string | null {
  const schedule = getEffectiveStaffDayHours({ dayOfWeek, workDays, workHours, businessHours });
  if (!schedule.worksDay || !schedule.startTime || !schedule.endTime) return null;
  return `${weekdayLabels[dayOfWeek]} from ${formatScheduleTimeLabel(schedule.startTime)} to ${formatScheduleTimeLabel(schedule.endTime)}`;
}

function dateStringInTimeZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isAppointmentWithinStaffHours({
  startTime,
  endTime,
  timezone,
  workDays,
  workHours,
  businessHours,
}: {
  startTime: Date;
  endTime: Date;
  timezone: string;
  workDays: number[];
  workHours?: unknown;
  businessHours?: unknown;
}): { allowed: boolean; dayOfWeek: number; startLabel: string | null; endLabel: string | null } {
  const dayOfWeek = weekdayIndexInTimeZone(startTime, timezone);
  const schedule = getEffectiveStaffDayHours({ workDays, workHours, businessHours, dayOfWeek });

  if (!schedule.worksDay || !schedule.startTime || !schedule.endTime) {
    return { allowed: false, dayOfWeek, startLabel: null, endLabel: null };
  }

  const dateStr = dateStringInTimeZone(startTime, timezone);
  const windowStart = localToUTC(
    dateStr,
    Number.parseInt(schedule.startTime.slice(0, 2), 10),
    Number.parseInt(schedule.startTime.slice(3, 5), 10),
    timezone
  );
  const windowEnd = localToUTC(
    dateStr,
    Number.parseInt(schedule.endTime.slice(0, 2), 10),
    Number.parseInt(schedule.endTime.slice(3, 5), 10),
    timezone
  );

  const allowed = startTime >= windowStart && endTime <= windowEnd;
  return {
    allowed,
    dayOfWeek,
    startLabel: schedule.startTime,
    endLabel: schedule.endTime,
  };
}
