import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { verifyPassword } from '@/lib/utils';

const BUSINESS_AUTH_SELECT = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  emailVerifiedAt: true,
  phone: true,
  street: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
} as const;

export type AuthenticatedBusiness = {
  id: string;
  email: string;
  name: string;
  businessId: string;
  onboardingComplete: boolean;
};

export class BusinessAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'MISSING_CREDENTIALS'
      | 'INVALID_CREDENTIALS'
      | 'EMAIL_NOT_VERIFIED'
      | 'SERVICE_UNAVAILABLE',
    public readonly status: number,
  ) {
    super(message);
    this.name = 'BusinessAuthError';
  }
}

export async function authenticateBusinessCredentials(input: {
  email?: string | null;
  password?: string | null;
}): Promise<AuthenticatedBusiness> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password ?? '';

  if (!email || !password) {
    throw new BusinessAuthError(
      'Please enter your email and password',
      'MISSING_CREDENTIALS',
      400,
    );
  }

  try {
    const business = await prisma.business.findUnique({
      where: { email },
      select: BUSINESS_AUTH_SELECT,
    });

    if (!business) {
      throw new BusinessAuthError(
        'Email or password is incorrect',
        'INVALID_CREDENTIALS',
        401,
      );
    }

    const isValid = await verifyPassword(password, business.passwordHash);
    if (!isValid) {
      throw new BusinessAuthError(
        'Email or password is incorrect',
        'INVALID_CREDENTIALS',
        401,
      );
    }

    if (!business.emailVerifiedAt) {
      throw new BusinessAuthError('EmailNotVerified', 'EMAIL_NOT_VERIFIED', 403);
    }

    return {
      id: business.id,
      email: business.email,
      name: business.name,
      businessId: business.id,
      onboardingComplete: isBusinessOnboardingComplete(business),
    };
  } catch (error) {
    if (error instanceof BusinessAuthError) {
      throw error;
    }

    console.error('Business auth error:', error);
    throw new BusinessAuthError(
      'Service temporarily unavailable',
      'SERVICE_UNAVAILABLE',
      503,
    );
  }
}
