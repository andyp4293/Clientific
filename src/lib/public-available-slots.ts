import { prisma } from '@/lib/prisma';
import {
  describeBusinessClosure,
  findBusinessClosureForDate,
} from '@/lib/business-closures';
import { localToUTC, weekdayIndexForLocalDate } from '@/lib/timezone';
import { validateBookableStaffSelection } from '@/lib/staff-service-validation';
import {
  buildAppointmentStartOptions,
  getEffectiveStaffDayHours,
  isAppointmentWithinStaffHours,
  normalizeBusinessHoursRecord,
} from '@/lib/staff-schedule';
import {
  appointmentsOverlap,
  buildServiceBookingSegments,
  getUniqueAssignedStaffIds,
  normalizeServiceStaffAssignments,
  shouldCreateSegmentedServiceBooking,
} from '@/lib/service-staff-assignments';

const businessTimeToUTC = localToUTC;

export type AvailabilityReason =
  | 'business_closed'
  | 'staff_off_day'
  | 'staff_outside_hours'
  | 'staff_cant_do_service'
  | 'staff_not_found';

export type PublicAvailableSlotsInput = {
  businessLookup: { slug: string } | { publicId: string };
  date: string | null;
  serviceId: string | null;
  serviceIds?: string[] | null;
  serviceStaffAssignments?: unknown;
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
  serviceStaffAssignments,
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
    include: {
      businessHours: true,
      closureDates: {
        select: {
          date: true,
          label: true,
        },
      },
    },
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
    select: { id: true, name: true, duration: true },
  });

  if (services.length !== requestedServiceIds.length) {
    throw new PublicAvailableSlotsError('Service not found', 404);
  }

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const orderedServices = requestedServiceIds
    .map((requestedId) => servicesById.get(requestedId))
    .filter((service): service is { id: string; name: string; duration: number } => Boolean(service));
  const normalizedServiceStaffAssignments = normalizeServiceStaffAssignments(
    serviceStaffAssignments,
    requestedServiceIds
  );
  const useSegmentedStaffAssignments = shouldCreateSegmentedServiceBooking({
    assignments: normalizedServiceStaffAssignments,
    orderedServiceIds: requestedServiceIds,
  });

  const dayOfWeek = weekdayIndexForLocalDate(date, business.timezone);
  const closure = findBusinessClosureForDate(date, business.closureDates);

  if (closure) {
    return {
      slots: [],
      unavailableSlots: [],
      availabilityReason: 'business_closed',
      message: describeBusinessClosure(closure),
    };
  }

  if (!business.businessHours) {
    return {
      slots: [],
      unavailableSlots: [],
      availabilityReason: 'business_closed',
      message: 'Business hours are not configured yet.',
    };
  }

  const hoursData = normalizeBusinessHoursRecord(business.businessHours.hours);
  const businessDayHours = hoursData[dayOfWeek];

  if (!businessDayHours?.isOpen || !businessDayHours.openTime || !businessDayHours.closeTime) {
    return {
      slots: [],
      unavailableSlots: [],
      availabilityReason: 'business_closed',
      message: 'Business is closed on this day.',
    };
  }

  if (!useSegmentedStaffAssignments && staffId && staffId !== 'anyone') {
    const staffValidation = await validateBookableStaffSelection({
      staffId,
      businessId: business.id,
      serviceIds: requestedServiceIds,
      dayOfWeek,
      businessHours: hoursData,
      timezone: business.timezone,
    });

    if (staffValidation) {
      const message =
        staffValidation.reason === 'staff_off_day'
          ? 'Selected staff member is off on this day.'
          : staffValidation.reason === 'staff_outside_hours'
            ? 'Selected staff member is unavailable at that time.'
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

  const parsedDuration = durationOverride ? Number.parseInt(durationOverride, 10) : NaN;
  const duration =
    !useSegmentedStaffAssignments && Number.isFinite(parsedDuration) && parsedDuration > 0
      ? parsedDuration
      : orderedServices.reduce((sum, service) => sum + service.duration, 0);
  const slotInterval = 30;

  let openTime = businessDayHours.openTime;
  let closeTimeLabel = businessDayHours.closeTime;

  if (!useSegmentedStaffAssignments && staffId && staffId !== 'anyone') {
    const staffMember = await prisma.staff.findFirst({
      where: { id: staffId, businessId: business.id, active: true },
      select: {
        workDays: true,
        workHours: true,
      },
    });

    if (!staffMember) {
      return {
        slots: [],
        unavailableSlots: [],
        availabilityReason: 'staff_not_found',
        message: 'Selected staff member was not found.',
      };
    }

    const staffDayHours = getEffectiveStaffDayHours({
      dayOfWeek,
      workDays: staffMember.workDays,
      workHours: staffMember.workHours,
      businessHours: hoursData,
    });

    if (!staffDayHours.worksDay) {
      return {
        slots: [],
        unavailableSlots: [],
        availabilityReason: 'staff_off_day',
        message: 'Selected staff member is off on this day.',
      };
    }

    if (!staffDayHours.startTime || !staffDayHours.endTime) {
      return {
        slots: [],
        unavailableSlots: [],
        availabilityReason: 'staff_off_day',
        message: 'Selected staff member is unavailable on this day.',
      };
    }

    openTime = staffDayHours.startTime;
    closeTimeLabel = staffDayHours.endTime;
  }

  const startOfDay = businessTimeToUTC(date, 0, 0, business.timezone);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  const closeTime = businessTimeToUTC(
    date,
    Number.parseInt(closeTimeLabel.slice(0, 2), 10),
    Number.parseInt(closeTimeLabel.slice(3, 5), 10),
    business.timezone
  );

  const previewSegments = buildServiceBookingSegments({
    assignments: normalizedServiceStaffAssignments,
    orderedServices,
    startTime: startOfDay,
  });
  const assignedStaffIds = useSegmentedStaffAssignments
    ? getUniqueAssignedStaffIds(previewSegments)
    : [];
  const assignedStaffMembers = useSegmentedStaffAssignments
    ? await prisma.staff.findMany({
        where: {
          businessId: business.id,
          active: true,
          id: { in: assignedStaffIds },
        },
        select: {
          id: true,
          fullName: true,
          workDays: true,
          workHours: true,
          serviceAssignments: { select: { serviceId: true } },
        },
      })
    : [];
  const assignedStaffById = new Map(assignedStaffMembers.map((member) => [member.id, member]));

  if (useSegmentedStaffAssignments) {
    for (const assignment of normalizedServiceStaffAssignments) {
      if (!assignment.staffId) continue;

      const staffMember = assignedStaffById.get(assignment.staffId);
      if (!staffMember) {
        return {
          slots: [],
          unavailableSlots: [],
          availabilityReason: 'staff_not_found',
          message: 'Selected staff member was not found.',
        };
      }

      if (!staffMember.workDays.includes(dayOfWeek)) {
        return {
          slots: [],
          unavailableSlots: [],
          availabilityReason: 'staff_off_day',
          message: `${staffMember.fullName} is off on this day.`,
        };
      }

      const assignedServices = staffMember.serviceAssignments.map((assignment) => assignment.serviceId);
      if (assignedServices.length > 0 && !assignedServices.includes(assignment.serviceId)) {
        return {
          slots: [],
          unavailableSlots: [],
          availabilityReason: 'staff_cant_do_service',
          message: `${staffMember.fullName} does not perform one of the selected services.`,
        };
      }
    }
  }

  const existingAppointments =
    useSegmentedStaffAssignments && assignedStaffIds.length > 0
      ? await prisma.appointment.findMany({
          where: {
            businessId: business.id,
            staffId: { in: assignedStaffIds },
            status: { in: ['pending', 'scheduled', 'confirmed'] },
            startTime: { gte: startOfDay, lte: endOfDay },
          },
        })
      : staffId && staffId !== 'anyone'
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

  const timeOptions = buildAppointmentStartOptions(openTime, closeTimeLabel, duration, slotInterval);

  for (const timeValue of timeOptions) {
    const slotTime = businessTimeToUTC(
      date,
      Number.parseInt(timeValue.slice(0, 2), 10),
      Number.parseInt(timeValue.slice(3, 5), 10),
      business.timezone
    );
    const slotEndTime = new Date(slotTime.getTime() + duration * 60000);

    if (slotEndTime > closeTime) continue;
    if (slotTime < new Date()) continue;

    const slotSegments = useSegmentedStaffAssignments
      ? buildServiceBookingSegments({
          assignments: normalizedServiceStaffAssignments,
          orderedServices,
          startTime: slotTime,
        })
      : [];
    const hasSegmentStaffUnavailable =
      useSegmentedStaffAssignments &&
      slotSegments.some((segment) => {
        if (!segment.staffId) return false;
        const staffMember = assignedStaffById.get(segment.staffId);
        if (!staffMember) return true;

        return !isAppointmentWithinStaffHours({
          startTime: segment.startTime,
          endTime: segment.endTime,
          timezone: business.timezone,
          workDays: staffMember.workDays,
          workHours: staffMember.workHours,
          businessHours: hoursData,
        }).allowed;
      });

    const hasConflict = useSegmentedStaffAssignments
      ? slotSegments.some((segment) => {
          if (!segment.staffId) return false;

          return existingAppointments.some((appointment) => {
            if (appointment.staffId !== segment.staffId) return false;
            return appointmentsOverlap(
              segment.startTime,
              segment.endTime,
              new Date(appointment.startTime),
              new Date(appointment.endTime)
            );
          });
        })
      : existingAppointments.some((appointment) => {
          const appointmentStart = new Date(appointment.startTime);
          const appointmentEnd = new Date(appointment.endTime);

          return appointmentsOverlap(slotTime, slotEndTime, appointmentStart, appointmentEnd);
        });

    if (hasSegmentStaffUnavailable || hasConflict) {
      unavailableSlots.push(slotTime.toISOString());
    } else {
      slots.push(slotTime.toISOString());
    }
  }

  return { slots, unavailableSlots };
}
