import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { resolveStaffPasswordChangeData } from '@/lib/staff-portal-access';
import { verifyPassword } from '@/lib/utils';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user?.businessId ||
    session.user.accountType !== 'staff' ||
    !session.user.staffId
  ) {
    return NextResponse.json({ error: 'Employee sign-in is required.' }, { status: 401 });
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
      id: session.user.staffId,
      businessId: session.user.businessId,
      active: true,
      portalAccessEnabled: true,
    },
    select: {
      id: true,
      portalPasswordHash: true,
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

  await prisma.staff.update({
    where: { id: staff.id },
    data: passwordChange.data,
  });

  return NextResponse.json({ success: true });
}
