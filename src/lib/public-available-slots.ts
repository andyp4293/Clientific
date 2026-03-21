import { prisma } from '@/lib/prisma';
import { localToUTC } from '@/lib/timezone';
import { validateBookableStaffSelection } from '@/lib/staff-service-validation';

const businessTimeToUTC = localToUTC;

export type AvailabilityReason =
  | 'business_closed'
  | 'staff_off_day'
  | 'staff_cant_do_service'
  | 'staff_not_found';

export type PublicAvailableSlotsInput = {
  businessLookup: { slug: string } | { publicId: string };
  date: string | null;
  serviceId: string | null;
  serviceIds?: string[] | null;
  staffId?: string | null;
  durationOverride?: string | null;
};

export type PublicAvailableSlotsResult = {
  slots: string[];
  unavailableSlots: string[];
  availabilityReason?: AvailabilityReason;
  message?: string;
};

export class PublicAvailableSlotsError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PublicAvailableSlotsError';
    this.status = status;
  }
}

export async function getPublicAvailableSlots({
  businessLookup,
  date,
  serviceId,
  serviceIds,
  staffId,
  durationOverride,
}: PublicAvailableSlotsInput): Promise<PublicAvailableSlotsResult> {
  const requestedServiceIds = Array.from(
    new Set(
      [
        ...(Array.isArray(serviceIds) ? serviceIds : []),
        ...(serviceId ? [serviceId] : []),
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
  );

  if (!date || requestedServiceIds.length === 0) {
    throw new PublicAvailableSlotsError('Date and service are required', 400);
  }

  const business = await prisma.business.findUnique({
    where: businessLookup,
    include: { businessHours: true },
  });

  if (!business) {
    throw new PublicAvailableSlotsError('Business not found', 404);
  }

  if (!business.enableOnlineBooking) {
    throw new PublicAvailableSlotsError('Online booking is not enabled', 403);
  }

  const services = await prisma.service.findMany({
    where: {
      id: { in: requestedServiceIds },
      businessId: business.id,
      active: true,
    },
    select: { id: true, duration: true },
  });

  if (services.length !== requestedServiceIds.length) {
    throw new PublicAvailableSlotsError('Service not found', 404);
  }

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const orderedServices = requestedServiceIds
    .map((requestedId) => servicesById.get(requestedId))
    .filter((service): service is { id: string; duration: number } => Boolean(service));

  const [year, month, day] = date.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day);
  const dayOfWeek = selectedDate.getDay();

  if (!business.businessHours) {
    return {
      slots: [],
      unavailableSlots: [],
      availabilityReason: 'business_closed',
      message: 'Business hours are not configured yet.',
    };
  }

  const hoursData = business.businessHours.hours as Record<
    string,
    { isOpen?: boolean; openTime?: string | null; closeTime?: string | null } | undefined
  >;
  const hours = hoursData[dayOfWeek.toString()];

  if (!hours || !hours.isOpen || !hours.openTime || !hours.closeTime) {
    return {
      slots: [],
      unavailableSlots: [],
      availabilityReason: 'business_closed',
      message: 'Business is closed on this day.',
    };
  }

  if (staffId && staffId !== 'anyone') {
    const staffValidation = await validateBookableStaffSelection({
      staffId,
      businessId: business.id,
      serviceIds: requestedServiceIds,
      dayOfWeek,
    });

    if (staffValidation) {
      const message =
        staffValidation.reason === 'staff_off_day'
          ? 'Selected staff member is off on this day.'
          : staffValidation.reason === 'staff_cant_do_service'
            ? 'Selected staff member does not perform one or more of the chosen services.'
            : 'Selected staff member was not found.';

      return {
        slots: [],
        unavailableSlots: [],
        availabilityReason: staffValidation.reason,
        message,
      };
    }
  }

  const [openHour, openMinute] = hours.openTime.split(':').map(Number);
  const [closeHour, closeMinute] = hours.closeTime.split(':').map(Number);
  const parsedDuration = durationOverride ? Number.parseInt(durationOverride, 10) : NaN;
  const duration =
    Number.isFinite(parsedDuration) && parsedDuration > 0
      ? parsedDuration
      : orderedServices.reduce((sum, service) => sum + service.duration, 0);
  const slotInterval = 30;

  const startOfDay = businessTimeToUTC(date, 0, 0, business.timezone);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  const closeTime = businessTimeToUTC(date, closeHour, closeMinute, business.timezone);

  const existingAppointments =
    staffId && staffId !== 'anyone'
      ? await prisma.appointment.findMany({
          where: {
            businessId: business.id,
            staffId,
            status: { in: ['pending', 'scheduled', 'confirmed'] },
            startTime: { gte: startOfDay, lte: endOfDay },
          },
        })
      : [];

  const slots: string[] = [];
  const unavailableSlots: string[] = [];

  for (let hour = openHour; hour < closeHour; hour++) {
    for (let minute = 0; minute < 60; minute += slotInterval) {
      if (hour === closeHour && minute >= closeMinute) break;
      if (hour === closeHour - 1 && minute + duration > 60 && closeMinute === 0) break;

      const slotTime = businessTimeToUTC(date, hour, minute, business.timezone);
      const slotEndTime = new Date(slotTime.getTime() + duration * 60000);

      if (slotEndTime > closeTime) continue;
      if (slotTime < new Date()) continue;

      const hasConflict = existingAppointments.some((appointment) => {
        const appointmentStart = new Date(appointment.startTime);
        const appointmentEnd = new Date(appointment.endTime);

        return (
          (slotTime >= appointmentStart && slotTime < appointmentEnd) ||
          (slotEndTime > appointmentStart && slotEndTime <= appointmentEnd) ||
          (slotTime <= appointmentStart && slotEndTime >= appointmentEnd)
        );
      });

      if (hasConflict) {
        unavailableSlots.push(slotTime.toISOString());
      } else {
        slots.push(slotTime.toISOString());
      }
    }
  }

  return { slots, unavailableSlots };
}
