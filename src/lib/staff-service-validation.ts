import { prisma } from '@/lib/prisma';

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
}): Promise<{ error: string; status: 404 | 400 } | null> {
  const staffMember = await prisma.staff.findFirst({
    where: { id: staffId, businessId },
    select: {
      id: true,
      serviceAssignments: { select: { serviceId: true } },
    },
  });

  if (!staffMember) {
    return { error: 'Staff member not found', status: 404 };
  }

  const assigned = staffMember.serviceAssignments.map((a) => a.serviceId);

  // No restrictions — can do any service
  if (assigned.length === 0) return null;

  const cannotPerform = serviceIds.filter((id) => !assigned.includes(id));
  if (cannotPerform.length > 0) {
    return {
      error: 'Selected staff member cannot perform one or more of the chosen services',
      status: 400,
    };
  }

  return null;
}
