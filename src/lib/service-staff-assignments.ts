export type ServiceStaffAssignmentInput = {
  serviceId?: unknown;
  staffId?: unknown;
};

export type ServiceStaffAssignment = {
  serviceId: string;
  staffId: string | null;
};

export type ServiceForBookingSegment = {
  id: string;
  name: string;
  duration: number;
  price?: number | null;
};

export type ServiceBookingSegment = {
  order: number;
  serviceId: string;
  serviceName: string;
  staffId: string | null;
  startTime: Date;
  endTime: Date;
  duration: number;
};

export function normalizeServiceStaffAssignments(
  rawAssignments: unknown,
  orderedServiceIds: string[]
): ServiceStaffAssignment[] {
  if (!Array.isArray(rawAssignments) || orderedServiceIds.length === 0) {
    return [];
  }

  const allowedServiceIds = new Set(orderedServiceIds);
  const byServiceId = new Map<string, string | null>();

  for (const rawAssignment of rawAssignments) {
    if (!rawAssignment || typeof rawAssignment !== 'object') continue;

    const assignment = rawAssignment as ServiceStaffAssignmentInput;
    if (typeof assignment.serviceId !== 'string') continue;

    const serviceId = assignment.serviceId.trim();
    if (!allowedServiceIds.has(serviceId)) continue;

    const staffId =
      typeof assignment.staffId === 'string' &&
      assignment.staffId.trim().length > 0 &&
      assignment.staffId.trim() !== 'anyone'
        ? assignment.staffId.trim()
        : null;

    byServiceId.set(serviceId, staffId);
  }

  return orderedServiceIds.map((serviceId) => ({
    serviceId,
    staffId: byServiceId.get(serviceId) ?? null,
  }));
}

export function shouldCreateSegmentedServiceBooking({
  assignments,
  orderedServiceIds,
}: {
  assignments: ServiceStaffAssignment[];
  orderedServiceIds: string[];
}) {
  return orderedServiceIds.length > 1 && assignments.some((assignment) => Boolean(assignment.staffId));
}

export function buildServiceBookingSegments({
  assignments,
  orderedServices,
  startTime,
}: {
  assignments: ServiceStaffAssignment[];
  orderedServices: ServiceForBookingSegment[];
  startTime: Date;
}): ServiceBookingSegment[] {
  const staffByServiceId = new Map(assignments.map((assignment) => [assignment.serviceId, assignment.staffId]));
  let cursor = new Date(startTime);

  return orderedServices.map((service, index) => {
    const segmentStart = cursor;
    const segmentEnd = new Date(segmentStart.getTime() + service.duration * 60_000);
    cursor = segmentEnd;

    return {
      order: index + 1,
      serviceId: service.id,
      serviceName: service.name,
      staffId: staffByServiceId.get(service.id) ?? null,
      startTime: segmentStart,
      endTime: segmentEnd,
      duration: service.duration,
    };
  });
}

export function getUniqueAssignedStaffIds(segments: ServiceBookingSegment[]) {
  return Array.from(
    new Set(
      segments
        .map((segment) => segment.staffId)
        .filter((staffId): staffId is string => Boolean(staffId))
    )
  );
}

export function appointmentsOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

export function buildSegmentServiceStaffSummary({
  segments,
  staffNamesById,
}: {
  segments: ServiceBookingSegment[];
  staffNamesById: Map<string, string>;
}) {
  return segments
    .map((segment) => {
      const staffName = segment.staffId ? staffNamesById.get(segment.staffId) : null;
      return staffName ? `${segment.serviceName} with ${staffName}` : `${segment.serviceName} with anyone available`;
    })
    .join(', ');
}

