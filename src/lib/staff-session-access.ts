import { prisma } from '@/lib/prisma';
import { isStaffPasswordChangeRequired } from '@/lib/staff-portal-access';

export type StaffSessionAccess =
  | {
      allowed: true;
      passwordChangeRequired: boolean;
      staffName: string;
    }
  | { allowed: false };

export async function getStaffSessionAccess(input: {
  staffId?: string | null;
  businessId?: string | null;
}): Promise<StaffSessionAccess> {
  if (!input.staffId || !input.businessId) {
    return { allowed: false };
  }

  const staff = await prisma.staff.findFirst({
    where: {
      id: input.staffId,
      businessId: input.businessId,
      active: true,
      portalAccessEnabled: true,
    },
    select: {
      fullName: true,
      portalAccessEnabled: true,
      portalPasswordHash: true,
      portalPasswordSetAt: true,
    },
  });

  if (!staff?.portalPasswordHash) {
    return { allowed: false };
  }

  return {
    allowed: true,
    passwordChangeRequired: isStaffPasswordChangeRequired(staff),
    staffName: staff.fullName,
  };
}
