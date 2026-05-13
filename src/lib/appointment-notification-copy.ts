type AppointmentNotificationCopyInput = {
  customerName?: string | null;
  serviceName?: string | null;
  staffName?: string | null;
  startTime: Date | string;
  timezone?: string | null;
};

function cleanLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function formatAppointmentNotificationTime(
  startTime: Date | string,
  timezone?: string | null,
) {
  const date = startTime instanceof Date ? startTime : new Date(startTime);

  if (Number.isNaN(date.getTime())) {
    return 'the selected time';
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone ?? undefined,
  }).format(date);
}

export function buildAppointmentBookedNotificationMessage({
  customerName,
  serviceName,
  staffName,
  startTime,
  timezone,
}: AppointmentNotificationCopyInput) {
  const customer = cleanLabel(customerName) ?? 'A customer';
  const service = cleanLabel(serviceName) ?? 'an appointment';
  const staff = cleanLabel(staffName);
  const time = formatAppointmentNotificationTime(startTime, timezone);

  return `${customer} booked ${service}${staff ? ` with ${staff}` : ''} for ${time}.`;
}

export function buildAppointmentScheduledNotificationMessage({
  customerName,
  serviceName,
  staffName,
  startTime,
  timezone,
}: AppointmentNotificationCopyInput) {
  const customer = cleanLabel(customerName) ?? 'A customer';
  const service = cleanLabel(serviceName) ?? 'an appointment';
  const staff = cleanLabel(staffName);
  const time = formatAppointmentNotificationTime(startTime, timezone);

  return `${customer} was scheduled for ${service}${staff ? ` with ${staff}` : ''} at ${time}.`;
}

export function buildAppointmentRescheduledNotificationMessage({
  customerName,
  serviceName,
  staffName,
  startTime,
  timezone,
}: AppointmentNotificationCopyInput) {
  const customer = cleanLabel(customerName) ?? 'A customer';
  const service = cleanLabel(serviceName) ?? 'an appointment';
  const staff = cleanLabel(staffName);
  const time = formatAppointmentNotificationTime(startTime, timezone);

  return `${customer} requested to move ${service}${staff ? ` with ${staff}` : ''} to ${time}.`;
}
