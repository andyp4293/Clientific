import tzLookup from 'tz-lookup';

/**
 * Convert a local business-timezone date+time to UTC.
 *
 * This is server-timezone-agnostic: it works correctly whether the server
 * runs in UTC, EST, or any other zone. The old approach of
 * `new Date(naiveUTC.toLocaleString(...))` is NOT safe because that Date
 * constructor parses the locale string in the *server's local timezone*,
 * causing the offset to cancel out when server == business timezone.
 */
export function localToUTC(
  dateStr: string,
  hour: number,
  minute: number,
  timezone: string
): Date {
  // Treat the target local time as-if it were UTC (naïve guess)
  const naiveUTC = new Date(
    `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`
  );

  // Ask Intl what that naïve-UTC instant looks like in the business timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(naiveUTC);

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  let h = get('hour');
  if (h === 24) h = 0; // midnight edge case in some locales

  // Reconstruct using Date.UTC — always UTC, no server-local-time parsing
  const tzDate = new Date(
    Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'))
  );

  // offsetMs = how far the naïve guess was from the real tz-local time
  const offsetMs = naiveUTC.getTime() - tzDate.getTime();
  return new Date(naiveUTC.getTime() + offsetMs);
}

/** Midnight at the start of `dateStr` in the business timezone, as UTC. */
export function businessDayStart(dateStr: string, timezone: string): Date {
  return localToUTC(dateStr, 0, 0, timezone);
}

export function weekdayIndexInTimeZone(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).format(date);

  switch (weekday) {
    case 'Sunday':
      return 0;
    case 'Monday':
      return 1;
    case 'Tuesday':
      return 2;
    case 'Wednesday':
      return 3;
    case 'Thursday':
      return 4;
    case 'Friday':
      return 5;
    case 'Saturday':
      return 6;
    default:
      return date.getUTCDay();
  }
}

export function timezoneFromCoordinates(
  latitude: number,
  longitude: number
): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;

  try {
    return tzLookup(latitude, longitude);
  } catch {
    return null;
  }
}
