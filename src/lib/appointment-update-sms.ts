const CUSTOMER_BOOKED_APPOINTMENT_SOURCES = new Set(['online', 'ai', 'sms_ai']);

type AppointmentUpdateInput = {
  startTime?: string | Date | null;
  duration?: number | string | null;
  serviceId?: string | null;
  serviceIds?: string[] | null;
  staffId?: string | null;
};

type AppointmentSnapshot = {
  startTime: Date | string;
  duration: number;
  serviceId?: string | null;
  serviceIds?: string[] | null;
  staffId?: string | null;
  source: string;
};

function sameOptionalId(a?: string | null, b?: string | null) {
  return (a || null) === (b || null);
}

function sameStringArray(a?: string[] | null, b?: string[] | null) {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isCustomerBookedAppointmentSource(source?: string | null) {
  return CUSTOMER_BOOKED_APPOINTMENT_SOURCES.has((source || '').trim().toLowerCase());
}

export function hasCustomerVisibleAppointmentChanges(
  appointment: AppointmentSnapshot,
  updates: AppointmentUpdateInput,
) {
  if (updates.startTime !== undefined) {
    const originalTimestamp = toTimestamp(appointment.startTime);
    const updatedTimestamp = toTimestamp(updates.startTime);
    if (updatedTimestamp !== null && originalTimestamp !== updatedTimestamp) {
      return true;
    }
  }

  if (
    updates.duration !== undefined &&
    updates.duration !== null &&
    Number(updates.duration) !== appointment.duration
  ) {
    return true;
  }

  if (
    updates.serviceId !== undefined &&
    !sameOptionalId(updates.serviceId, appointment.serviceId ?? null)
  ) {
    return true;
  }

  if (
    updates.serviceIds !== undefined &&
    !sameStringArray(updates.serviceIds, appointment.serviceIds)
  ) {
    return true;
  }

  if (
    updates.staffId !== undefined &&
    !sameOptionalId(updates.staffId, appointment.staffId ?? null)
  ) {
    return true;
  }

  return false;
}
