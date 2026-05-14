import { NextResponse } from 'next/server';
import {
  authenticateBusinessCredentials,
  BusinessAuthError,
} from '@/lib/business-auth';
import {
  authenticateStaffCredentials,
  StaffAuthError,
} from '@/lib/staff-auth';
import { createMobileSessionToken } from '@/lib/mobile-session';

export async function POST(request: Request) {
  let body: { email?: string; password?: string } | null = null;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const credentials = {
      email: body?.email,
      password: body?.password,
    };
    let account:
      | (Awaited<ReturnType<typeof authenticateBusinessCredentials>> & { accountType: 'owner' })
      | Awaited<ReturnType<typeof authenticateStaffCredentials>>;

    try {
      const business = await authenticateBusinessCredentials(credentials);
      account = { ...business, accountType: 'owner' };
    } catch (businessError) {
      if (
        businessError instanceof BusinessAuthError &&
        !['INVALID_CREDENTIALS', 'MISSING_CREDENTIALS'].includes(businessError.code)
      ) {
        throw businessError;
      }

      try {
        account = await authenticateStaffCredentials(credentials);
      } catch (staffError) {
        if (staffError instanceof StaffAuthError && staffError.code === 'SERVICE_UNAVAILABLE') {
          throw staffError;
        }

        throw businessError;
      }
    }

    const token = await createMobileSessionToken({
      businessId: account.businessId,
      email: account.email,
      name: account.name,
      onboardingComplete: account.onboardingComplete,
      accountType: account.accountType,
      staffId: account.accountType === 'staff' ? account.staffId : null,
      staffName: account.accountType === 'staff' ? account.staffName : null,
    });

    return NextResponse.json({
      token,
      business: {
        id: account.businessId,
        email: account.email,
        name: account.accountType === 'staff' ? account.businessName : account.name,
        onboardingComplete: account.onboardingComplete,
      },
      viewer: {
        role: account.accountType,
        staffId: account.accountType === 'staff' ? account.staffId : null,
        staffName: account.accountType === 'staff' ? account.staffName : null,
      },
    });
  } catch (error) {
    if (error instanceof BusinessAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof StaffAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('POST /api/mobile/auth/login error:', error);
    return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 500 });
  }
}
