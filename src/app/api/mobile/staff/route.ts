import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription, checkPlanLimit } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import {
  normalizeStaffWorkHours,
  sanitizeStaffWorkHoursForSave,
} from '@/lib/staff-schedule';
import { formatPhoneForDisplay, normalizeOptionalStoredPhoneNumber } from '@/lib/phone';
import { getStaffCacheTag } from '@/lib/cache-tags';
import { revalidateTag } from 'next/cache';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isDayNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

function formatWorkDaysLabel(workDays: number[]) {
  if (!workDays.length) {
    return 'No work days set';
  }

  if (workDays.length === 7) {
    return 'Available all week';
  }

  return workDays
    .slice()
    .sort((left, right) => left - right)
    .map((day) => DAY_LABELS[day] ?? `Day ${day}`)
    .join(', ');
}

function formatWorkHoursLabel(workHours: unknown, workDays: number[]) {
  const normalized = normalizeStaffWorkHours(workHours);
  const coveredDays = workDays
    .filter((day) => normalized[day]?.startTime && normalized[day]?.endTime)
    .sort((left, right) => left - right);

  if (!coveredDays.length) {
    return 'Uses business hours';
  }

  return coveredDays
    .map((day) => {
      const slot = normalized[day];
      return `${DAY_LABELS[day]} ${slot?.startTime}-${slot?.endTime}`;
    })
    .join(' • ');
}

export async function POST(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const limitCheck = await checkPlanLimit(authorized.session.businessId, 'staff');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Staff limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan.`,
          code: 'PLAN_LIMIT_REACHED',
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
    const email =
      typeof body?.email === 'string' && body.email.trim().length > 0
        ? body.email.trim()
        : null;
    const phone =
      typeof body?.phone === 'string' && body.phone.trim().length > 0
        ? normalizeOptionalStoredPhoneNumber(body.phone)
        : null;
    const role =
      typeof body?.role === 'string' && body.role.trim().length > 0
        ? body.role.trim()
        : null;
    const isActive = body?.isActive !== false;
    const workDays = Array.isArray(body?.workDays)
      ? body.workDays.filter(isDayNumber)
      : [0, 1, 2, 3, 4, 5, 6];
    const serviceIds = Array.isArray(body?.serviceIds)
      ? body.serviceIds.filter((value: unknown): value is string => typeof value === 'string')
      : [];

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Staff name', value: fullName },
      { label: 'Role', value: role },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const businessHours = await prisma.businessHours.findUnique({
      where: { businessId: authorized.session.businessId },
      select: { hours: true },
    });
    const sanitizedWorkHours = sanitizeStaffWorkHoursForSave({
      workDays,
      workHours: body?.workHours,
      businessHours: businessHours?.hours,
    });

    const staff = await prisma.$transaction(async (tx) => {
      const created = await tx.staff.create({
        data: {
          businessId: authorized.session.businessId,
          fullName,
          email,
          phone,
          role,
          active: isActive,
          workDays,
          workHours: Object.keys(sanitizedWorkHours).length > 0 ? sanitizedWorkHours : undefined,
        },
      });

      if (serviceIds.length) {
        await tx.staffService.createMany({
          data: serviceIds.map((serviceId: string) => ({
            staffId: created.id,
            serviceId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.staff.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          serviceAssignments: {
            select: { serviceId: true },
          },
        },
      });
    });

    const serviceNameRows = serviceIds.length
      ? await prisma.service.findMany({
          where: {
            businessId: authorized.session.businessId,
            id: { in: serviceIds },
          },
          select: { id: true, name: true },
        })
      : [];
    const serviceNameById = new Map(serviceNameRows.map((service) => [service.id, service.name]));

    revalidateTag(getStaffCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json(
      {
        staff: {
          id: staff.id,
          fullName: staff.fullName,
          email: staff.email,
          phone: staff.phone,
          phoneDisplay: formatPhoneForDisplay(staff.phone),
          role: staff.role,
          isActive: staff.active,
          workDays: staff.workDays,
          workHours: normalizeStaffWorkHours(staff.workHours),
          workDaysLabel: formatWorkDaysLabel(staff.workDays),
          workHoursLabel: formatWorkHoursLabel(staff.workHours, staff.workDays),
          serviceCount: serviceIds.length,
          serviceIds,
          serviceNames: serviceIds
            .map((serviceId: string) => serviceNameById.get(serviceId))
            .filter((name: string | undefined): name is string => Boolean(name)),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/mobile/staff error:', error);
    return NextResponse.json({ error: 'Unable to create staff member' }, { status: 500 });
  }
}
