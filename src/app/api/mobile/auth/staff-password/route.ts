import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMobileSessionToken } from '@/lib/mobile-session';
import { requireMobileSession } from '@/lib/mobile-route';
import { resolveStaffPasswordChangeData } from '@/lib/staff-portal-access';
import { verifyPassword } from '@/lib/utils';

export async function POST(request: Request) {
  const authorized = await requireMobileSession(request, {
    allowStaff: true,
    allowPasswordChangeRequired: true,
  });
  if ('error' in authorized) {
    return authorized.error;
  }

  if (authorized.session.accountType !== 'staff' || !authorized.session.staffId) {
    return NextResponse.json({ error: 'Employee sign-in is required.' }, { status: 403 });
  }

  let body: { currentPassword?: unknown; newPassword?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const currentPassword =
    typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const passwordChange = await resolveStaffPasswordChangeData(body?.newPassword);
  if ('error' in passwordChange) {
    return NextResponse.json({ error: passwordChange.error }, { status: 400 });
  }

  const staff = await prisma.staff.findFirst({
    where: {
      id: authorized.session.staffId,
      businessId: authorized.session.businessId,
      active: true,
      portalAccessEnabled: true,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      portalPasswordHash: true,
      business: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!staff?.portalPasswordHash) {
    return NextResponse.json({ error: 'Employee app access is disabled.' }, { status: 403 });
  }

  const currentPasswordValid = await verifyPassword(currentPassword, staff.portalPasswordHash);
  if (!currentPasswordValid) {
    return NextResponse.json(
      { error: 'Temporary password is incorrect.' },
      { status: 400 },
    );
  }

  const updatedStaff = await prisma.staff.update({
    where: { id: staff.id },
    data: passwordChange.data,
    select: {
      id: true,
      fullName: true,
      email: true,
      business: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  const token = await createMobileSessionToken({
    businessId: updatedStaff.business.id,
    email: updatedStaff.email ?? authorized.session.email,
    name: updatedStaff.fullName,
    onboardingComplete: true,
    accountType: 'staff',
    staffId: updatedStaff.id,
    staffName: updatedStaff.fullName,
    staffPasswordChangeRequired: false,
  });

  return NextResponse.json({
    token,
    business: {
      id: updatedStaff.business.id,
      email: updatedStaff.business.email,
      name: updatedStaff.business.name,
      onboardingComplete: true,
    },
    viewer: {
      role: 'staff',
      staffId: updatedStaff.id,
      staffName: updatedStaff.fullName,
      privacy: 'customer_phone_hidden',
      passwordChangeRequired: false,
    },
  });
}
