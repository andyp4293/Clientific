import { prisma } from '@/lib/prisma';

/**
 * Fetch active staff for a business and optionally filter to those who can
 * perform ALL of the requested services.
 *
 * The rule is:
 *   • A staff member with NO service assignments can perform every service.
 *   • A staff member WITH assignments can only perform the listed services.
 *
 * When `requiredServiceIds` is empty, all active staff are returned.
 */
export async function getPublicStaff({
  businessId,
  requiredServiceIds = [],
}: {
  businessId: string;
  requiredServiceIds?: string[];
}) {
  const allStaff = await prisma.staff.findMany({
    where: { businessId, active: true },
    select: {
      id: true,
      fullName: true,
      role: true,
      serviceAssignments: { select: { serviceId: true } },
    },
    orderBy: { fullName: 'asc' },
  });

  const filtered =
    requiredServiceIds.length === 0
      ? allStaff
      : allStaff.filter((member) => {
          const assigned = member.serviceAssignments.map((a) => a.serviceId);
          // No restrictions → can do everything
          if (assigned.length === 0) return true;
          // Must be able to do all requested services
          return requiredServiceIds.every((id) => assigned.includes(id));
        });

  // Strip the internal serviceAssignments from the public payload
  return filtered.map(({ serviceAssignments: _a, ...rest }) => rest);
}
