import { NextResponse } from 'next/server';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { getStaffSessionAccess } from '@/lib/staff-session-access';

export function mobileUnauthorizedResponse(message = 'Mobile sign-in is required.') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function mobileForbiddenResponse(
  message = 'Employee accounts can only access assigned appointments.',
) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireMobileSession(
  request: Request,
  options: { allowStaff?: boolean; allowPasswordChangeRequired?: boolean } = {},
) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: mobileUnauthorizedResponse() } as const;
  }

  try {
    const session = await verifyMobileSessionToken(token);
    if (session.accountType === 'staff') {
      const access = await getStaffSessionAccess({
        staffId: session.staffId,
        businessId: session.businessId,
      });
      if (!access.allowed) {
        return {
          error: mobileUnauthorizedResponse('Employee login has been disabled.'),
        } as const;
      }
      session.staffPasswordChangeRequired = access.passwordChangeRequired;
      session.staffName = access.staffName;
    }
    if (
      session.accountType === 'staff' &&
      session.staffPasswordChangeRequired &&
      !options.allowPasswordChangeRequired
    ) {
      return {
        error: NextResponse.json(
          {
            error: 'Create your employee password before using the app.',
            code: 'STAFF_PASSWORD_CHANGE_REQUIRED',
          },
          { status: 403 },
        ),
      } as const;
    }
    if (session.accountType === 'staff' && !options.allowStaff) {
      return { error: mobileForbiddenResponse() } as const;
    }
    return { session } as const;
  } catch {
    return { error: mobileUnauthorizedResponse() } as const;
  }
}
