import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { requireActiveSubscription, checkPlanLimit } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { normalizeStaffWorkHours, sanitizeStaffWorkHoursForSave } from '@/lib/staff-schedule';

const STAFF_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  businessId: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  active: true,
  workDays: true,
  workHours: true,
  serviceAssignments: { select: { serviceId: true } },
} as const;

function mapStaff(member: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  businessId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  workDays: number[];
  workHours: unknown;
  serviceAssignments: { serviceId: string }[];
}) {
  const { serviceAssignments, active, workHours, ...rest } = member;
  return {
    ...rest,
    active,
    isActive: active,
    workHours: normalizeStaffWorkHours(workHours),
    // Empty array = no restrictions (can perform all services).
    // Non-empty = only these service IDs.
    serviceIds: serviceAssignments.map((a) => a.serviceId),
  };
}

// GET - List all staff members for the business
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staff = await prisma.staff.findMany({
      where: { businessId: session.user.id },
      orderBy: { fullName: 'asc' },
      select: STAFF_SELECT,
    });

    return NextResponse.json({ staff: staff.map(mapStaff) });
  } catch (error: any) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
}

// POST - Create a new staff member
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const limitCheck = await checkPlanLimit(session.user.id, 'staff');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Staff limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan.`,
          code: 'PLAN_LIMIT_REACHED',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { fullName, email, phone, role, bio, workDays, workHours, serviceIds } = body;

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Staff name', value: fullName },
      { label: 'Role', value: role },
      { label: 'Bio', value: bio },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const validatedServiceIds: string[] = Array.isArray(serviceIds) ? serviceIds : [];
    const normalizedWorkDays = Array.isArray(workDays) ? workDays : [0, 1, 2, 3, 4, 5, 6];
    const businessHours = await prisma.businessHours.findUnique({
      where: { businessId: session.user.id },
      select: { hours: true },
    });
    const sanitizedWorkHours = sanitizeStaffWorkHoursForSave({
      workDays: normalizedWorkDays,
      workHours,
      businessHours: businessHours?.hours,
    });

    const staff = await prisma.$transaction(async (tx) => {
      const created = await tx.staff.create({
        data: {
          businessId: session.user.id,
          fullName,
          email: email || null,
          phone: phone || null,
          role: role || undefined,
          active: true,
          workDays: normalizedWorkDays,
          workHours: Object.keys(sanitizedWorkHours).length > 0 ? sanitizedWorkHours : undefined,
        },
        select: STAFF_SELECT,
      });

      if (validatedServiceIds.length > 0) {
        await tx.staffService.createMany({
          data: validatedServiceIds.map((serviceId) => ({
            staffId: created.id,
            serviceId,
          })),
          skipDuplicates: true,
        });
        // Re-fetch to get the assignments
        return tx.staff.findUniqueOrThrow({
          where: { id: created.id },
          select: STAFF_SELECT,
        });
      }

      return created;
    });

    return NextResponse.json({ staff: mapStaff(staff) }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}
