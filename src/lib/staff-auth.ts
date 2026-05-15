import { prisma } from '@/lib/prisma';
import { isStaffPasswordChangeRequired } from '@/lib/staff-portal-access';
import { verifyPassword } from '@/lib/utils';

const STAFF_AUTH_SELECT = {
  id: true,
  fullName: true,
  email: true,
  portalPasswordHash: true,
  portalPasswordSetAt: true,
  active: true,
  portalAccessEnabled: true,
  businessId: true,
  business: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} as const;

export type AuthenticatedStaff = {
  id: string;
  email: string;
  name: string;
  businessId: string;
  staffId: string;
  staffName: string;
  businessName: string;
  onboardingComplete: boolean;
  passwordChangeRequired: boolean;
  accountType: 'staff';
};

export class StaffAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'MISSING_CREDENTIALS'
      | 'INVALID_CREDENTIALS'
      | 'AMBIGUOUS_EMAIL'
      | 'SERVICE_UNAVAILABLE',
    public readonly status: number,
  ) {
    super(message);
    this.name = 'StaffAuthError';
  }
}

export async function authenticateStaffCredentials(input: {
  email?: string | null;
  password?: string | null;
}): Promise<AuthenticatedStaff> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password ?? '';

  if (!email || !password) {
    throw new StaffAuthError(
      'Please enter your email and password',
      'MISSING_CREDENTIALS',
      400,
    );
  }

  try {
    const matchingStaff = await prisma.staff.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        active: true,
        portalAccessEnabled: true,
      },
      select: STAFF_AUTH_SELECT,
      take: 2,
    });

    if (matchingStaff.length !== 1) {
      throw new StaffAuthError(
        'Email or password is incorrect',
        matchingStaff.length > 1 ? 'AMBIGUOUS_EMAIL' : 'INVALID_CREDENTIALS',
        401,
      );
    }

    const [staff] = matchingStaff;
    if (!staff.portalPasswordHash) {
      throw new StaffAuthError(
        'Email or password is incorrect',
        'INVALID_CREDENTIALS',
        401,
      );
    }

    const isValid = await verifyPassword(password, staff.portalPasswordHash);
    if (!isValid) {
      throw new StaffAuthError(
        'Email or password is incorrect',
        'INVALID_CREDENTIALS',
        401,
      );
    }

    const passwordChangeRequired = isStaffPasswordChangeRequired(staff);

    return {
      id: staff.id,
      email: staff.email ?? email,
      name: staff.fullName,
      businessId: staff.businessId,
      staffId: staff.id,
      staffName: staff.fullName,
      businessName: staff.business.name,
      onboardingComplete: !passwordChangeRequired,
      passwordChangeRequired,
      accountType: 'staff',
    };
  } catch (error) {
    if (error instanceof StaffAuthError) {
      throw error;
    }

    console.error('Staff auth error:', error);
    throw new StaffAuthError(
      'Service temporarily unavailable',
      'SERVICE_UNAVAILABLE',
      503,
    );
  }
}
