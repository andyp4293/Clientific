function isValidTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function timeStringToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function compareTimeStrings(a: string, b: string): number {
  return timeStringToMinutes(a) - timeStringToMinutes(b);
}

function addMinutesToTimeString(value: string, minutesToAdd: number): string {
  const total = timeStringToMinutes(value) + minutesToAdd;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function buildTimeOptions(
  startTime: string,
  endTime: string,
  options?: { includeEnd?: boolean; stepMinutes?: number },
): string[] {
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
    return [];
  }

  const includeEnd = options?.includeEnd ?? false;
  const stepMinutes = options?.stepMinutes ?? 30;
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  if (startMinutes >= endMinutes || stepMinutes <= 0) {
    return [];
  }

  const times: string[] = [];
  for (
    let minutes = startMinutes;
    includeEnd ? minutes <= endMinutes : minutes < endMinutes;
    minutes += stepMinutes
  ) {
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
  stepMinutes = 30,
): string[] {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return [];
  }

  const lastPossibleStart = addMinutesToTimeString(endTime, -durationMinutes);
  if (compareTimeStrings(startTime, lastPossibleStart) > 0) {
    return [];
  }

  return buildTimeOptions(
    startTime,
    addMinutesToTimeString(lastPossibleStart, stepMinutes),
    {
      includeEnd: false,
      stepMinutes,
    },
  );
}

export function formatScheduleTimeLabel(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hourLabel = hours % 12 === 0 ? 12 : hours % 12;
  return `${hourLabel}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
