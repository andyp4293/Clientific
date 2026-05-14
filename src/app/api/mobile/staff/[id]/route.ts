import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import {
  normalizeStaffWorkHours,
  sanitizeStaffWorkHoursForSave,
} from '@/lib/staff-schedule';
import { normalizeOptionalStoredPhoneNumber, formatPhoneForDisplay } from '@/lib/phone';
import { getStaffBioValidationError, normalizeStaffBio } from '@/lib/staff-bio';
import {
  hasStaffPortalPassword,
  normalizeStaffEmail,
  resolveStaffPortalAccessData,
} from '@/lib/staff-portal-access';
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

async function formatStaffResponse(businessId: string, staff: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  bio: string | null;
  active: boolean;
  portalAccessEnabled: boolean;
  portalPasswordHash: string | null;
  workDays: number[];
  workHours: unknown;
  serviceAssignments: { serviceId: string }[];
}) {
  const serviceIds = staff.serviceAssignments.map((assignment) => assignment.serviceId);
  const serviceNames = serviceIds.length
    ? await prisma.service.findMany({
        where: {
          businessId,
          id: { in: serviceIds },
        },
        select: { id: true, name: true },
      })
    : [];
  const serviceNameById = new Map(serviceNames.map((service) => [service.id, service.name]));

  return {
    id: staff.id,
    fullName: staff.fullName,
    email: staff.email,
    phone: staff.phone,
    phoneDisplay: formatPhoneForDisplay(staff.phone),
    role: staff.role,
    bio: staff.bio,
    isActive: staff.active,
    portalAccessEnabled: staff.portalAccessEnabled,
    hasPortalPassword: hasStaffPortalPassword(staff),
    workDays: staff.workDays,
    workHours: normalizeStaffWorkHours(staff.workHours),
    workDaysLabel: formatWorkDaysLabel(staff.workDays),
    workHoursLabel: formatWorkHoursLabel(staff.workHours, staff.workDays),
    serviceCount: serviceIds.length,
    serviceIds,
    serviceNames: serviceIds
      .map((serviceId: string) => serviceNameById.get(serviceId))
      .filter((name: string | undefined): name is string => Boolean(name)),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const { id } = await params;
    const body = await request.json();
    const fullName = body?.fullName === undefined ? undefined : String(body.fullName).trim();
    const email = body?.email === undefined ? undefined : normalizeStaffEmail(body.email);
    const phone =
      body?.phone === undefined
        ? undefined
        : typeof body.phone === 'string' && body.phone.trim().length > 0
          ? normalizeOptionalStoredPhoneNumber(body.phone)
          : null;
    const role =
      body?.role === undefined
        ? undefined
        : typeof body.role === 'string' && body.role.trim().length > 0
          ? body.role.trim()
          : null;
    const bio = body?.bio === undefined ? undefined : normalizeStaffBio(body.bio);
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : undefined;
    const workDays = Array.isArray(body?.workDays)
      ? body.workDays.filter(isDayNumber)
      : undefined;
    const serviceIds = Array.isArray(body?.serviceIds)
      ? body.serviceIds.filter((value: unknown): value is string => typeof value === 'string')
      : undefined;

    const bioValidationError = getStaffBioValidationError(body?.bio);
    if (bioValidationError) {
      return NextResponse.json({ error: bioValidationError }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Staff name', value: fullName },
      { label: 'Role', value: role },
      { label: 'Bio', value: bio },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (fullName !== undefined && !fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    const existingStaff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!existingStaff || existingStaff.businessId !== authorized.session.businessId) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const portalAccess = await resolveStaffPortalAccessData({
      email: email ?? existingStaff.email,
      existing: {
        email: existingStaff.email,
        portalAccessEnabled: existingStaff.portalAccessEnabled,
        portalPasswordHash: existingStaff.portalPasswordHash,
      },
      portalAccessEnabled: body?.portalAccessEnabled,
      portalPassword: body?.portalPassword,
    });
    if ('error' in portalAccess) {
      return NextResponse.json({ error: portalAccess.error }, { status: 400 });
    }

    const nextWorkDays = workDays ?? existingStaff.workDays;
    const businessHours = await prisma.businessHours.findUnique({
      where: { businessId: authorized.session.businessId },
      select: { hours: true },
    });
    const sanitizedWorkHours =
      body?.workHours !== undefined || Array.isArray(workDays)
        ? sanitizeStaffWorkHoursForSave({
            workDays: nextWorkDays,
            workHours: body?.workHours,
            businessHours: businessHours?.hours,
          })
        : undefined;

    const staff = await prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({
        where: { id },
        data: {
          ...(fullName !== undefined ? { fullName } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(role !== undefined ? { role } : {}),
          ...(bio !== undefined ? { bio } : {}),
          ...(isActive !== undefined ? { active: isActive } : {}),
          ...portalAccess.data,
          ...(workDays !== undefined ? { workDays: nextWorkDays } : {}),
          ...(sanitizedWorkHours !== undefined
            ? {
                workHours:
                  Object.keys(sanitizedWorkHours).length > 0
                    ? sanitizedWorkHours
                    : Prisma.JsonNull,
              }
            : {}),
        },
      });

      if (Array.isArray(serviceIds)) {
        await tx.staffService.deleteMany({ where: { staffId: id } });
        if (serviceIds.length) {
          await tx.staffService.createMany({
            data: serviceIds.map((serviceId: string) => ({ staffId: id, serviceId })),
            skipDuplicates: true,
          });
        }
      }

      return tx.staff.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          serviceAssignments: {
            select: { serviceId: true },
          },
        },
      });
    });

    revalidateTag(getStaffCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({
      staff: await formatStaffResponse(authorized.session.businessId, staff),
    });
  } catch (error) {
    console.error('PATCH /api/mobile/staff/[id] error:', error);
    return NextResponse.json({ error: 'Unable to update staff member' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const { id } = await params;
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!existingStaff || existingStaff.businessId !== authorized.session.businessId) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const appointmentCount = await prisma.appointment.count({
      where: {
        staffId: id,
        status: { in: ['scheduled', 'confirmed'] },
      },
    });

    if (appointmentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete staff member with scheduled appointments' },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.appointment.updateMany({ where: { staffId: id }, data: { staffId: null } }),
      prisma.checkIn.updateMany({ where: { staffId: id }, data: { staffId: null } }),
      prisma.staff.delete({ where: { id } }),
    ]);

    revalidateTag(getStaffCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/mobile/staff/[id] error:', error);
    return NextResponse.json({ error: 'Unable to delete staff member' }, { status: 500 });
  }
}
