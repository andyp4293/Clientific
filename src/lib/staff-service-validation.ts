import { prisma } from '@/lib/prisma';
import {
  formatStaffDayWindow,
  isAppointmentWithinStaffHours,
} from '@/lib/staff-schedule';

export type StaffSelectionValidationError = {
  error: string;
  status: 404 | 400;
  reason: 'staff_not_found' | 'staff_off_day' | 'staff_cant_do_service' | 'staff_outside_hours';
};

/**
 * Validates that a specific staff member can perform all of the given services.
 *
 * Returns null when the staff member exists and is capable.
 * Returns an error object when validation fails.
 *
 * Rule: A staff member with NO assignments can perform every service.
 *       A staff member WITH assignments can only perform the listed services.
 */
export async function validateStaffCanPerformServices({
  staffId,
  businessId,
  serviceIds,
}: {
  staffId: string;
  businessId: string;
  serviceIds: string[];
}): Promise<StaffSelectionValidationError | null> {
  const staffMember = await prisma.staff.findFirst({
    where: { id: staffId, businessId },
    select: {
      id: true,
      serviceAssignments: { select: { serviceId: true } },
    },
  });

  if (!staffMember) {
    return { error: 'Staff member not found', status: 404, reason: 'staff_not_found' };
  }

  const assigned = staffMember.serviceAssignments.map((a) => a.serviceId);

  // No restrictions — can do any service
  if (assigned.length === 0) return null;

  const cannotPerform = serviceIds.filter((id) => !assigned.includes(id));
  if (cannotPerform.length > 0) {
    return {
      error: 'Selected staff member cannot perform one or more of the chosen services',
      status: 400,
      reason: 'staff_cant_do_service',
    };
  }

  return null;
}

export async function validateBookableStaffSelection({
  staffId,
  businessId,
  serviceIds,
  dayOfWeek,
  businessHours,
  timezone,
  startTime,
  endTime,
}: {
  staffId: string;
  businessId: string;
  serviceIds: string[];
  dayOfWeek?: number;
  businessHours?: unknown;
  timezone?: string;
  startTime?: Date;
  endTime?: Date;
}): Promise<StaffSelectionValidationError | null> {
  const staffMember = await prisma.staff.findFirst({
    where: { id: staffId, businessId, active: true },
    select: {
      id: true,
      fullName: true,
      workDays: true,
      workHours: true,
      serviceAssignments: { select: { serviceId: true } },
    },
  });

  if (!staffMember) {
    return { error: 'Staff member not found', status: 404, reason: 'staff_not_found' };
  }

  if (typeof dayOfWeek === 'number' && !staffMember.workDays.includes(dayOfWeek)) {
    return {
      error: `${staffMember.fullName} doesn't work on that day.`,
      status: 400,
      reason: 'staff_off_day',
    };
  }

  if (startTime && endTime && timezone) {
    const scheduleCheck = isAppointmentWithinStaffHours({
      startTime,
      endTime,
      timezone,
      workDays: staffMember.workDays,
      workHours: staffMember.workHours,
      businessHours,
    });

    if (!scheduleCheck.allowed) {
      const workingWindow = formatStaffDayWindow({
        dayOfWeek: scheduleCheck.dayOfWeek,
        workDays: staffMember.workDays,
        workHours: staffMember.workHours,
        businessHours,
      });

      if (!workingWindow) {
        return {
          error: `${staffMember.fullName} doesn't work on that day.`,
          status: 400,
          reason: 'staff_off_day',
        };
      }

      return {
        error: `${staffMember.fullName} is available ${workingWindow}.`,
        status: 400,
        reason: 'staff_outside_hours',
      };
    }
  }

  const assigned = staffMember.serviceAssignments.map((assignment) => assignment.serviceId);
  if (assigned.length === 0) return null;

  const cannotPerform = serviceIds.filter((id) => !assigned.includes(id));
  if (cannotPerform.length > 0) {
    return {
      error: 'Selected staff member cannot perform one or more of the chosen services',
      status: 400,
      reason: 'staff_cant_do_service',
    };
  }

  return null;
}
