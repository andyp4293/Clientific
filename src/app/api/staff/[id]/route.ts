import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { normalizeStaffWorkHours, sanitizeStaffWorkHoursForSave } from '@/lib/staff-schedule';
import { normalizeOptionalStoredPhoneNumber } from '@/lib/phone';
import { getStaffBioValidationError, normalizeStaffBio } from '@/lib/staff-bio';
import {
  hasStaffPortalPassword,
  isStaffPasswordChangeRequired,
  normalizeStaffEmail,
  resolveStaffPortalAccessData,
} from '@/lib/staff-portal-access';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { getStaffCacheTag } from '@/lib/cache-tags';
import { sendStaffTemporaryPasswordEmail } from '@/lib/email';
import { revalidateTag } from 'next/cache';

const STAFF_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  businessId: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  bio: true,
  active: true,
  portalAccessEnabled: true,
  portalPasswordHash: true,
  portalPasswordSetAt: true,
  workDays: true,
  workHours: true,
  serviceAssignments: { select: { serviceId: true } },
} as const;

// PATCH - Update staff member
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.accountType === 'staff') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;
    const body = await req.json();
    const {
      fullName,
      email,
      phone,
      role,
      bio,
      isActive,
      workDays,
      workHours,
      serviceIds,
      portalAccessEnabled,
      portalPassword,
    } = body;
    const normalizedEmail = email === undefined ? undefined : normalizeStaffEmail(email);
    const normalizedBio = bio === undefined ? undefined : normalizeStaffBio(bio);
    const normalizedPhone =
      typeof phone === 'string' && phone.trim().length > 0
        ? normalizeOptionalStoredPhoneNumber(phone)
        : typeof phone === 'string'
          ? null
          : phone;

    const bioValidationError = getStaffBioValidationError(bio);
    if (bioValidationError) {
      return NextResponse.json({ error: bioValidationError }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Staff name', value: fullName },
      { label: 'Role', value: role },
      { label: 'Bio', value: normalizedBio },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    // Verify staff belongs to this business
    const existingStaff = await prisma.staff.findUnique({ where: { id } });
    if (!existingStaff || existingStaff.businessId !== session.user.id) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const portalAccess = await resolveStaffPortalAccessData({
      email: normalizedEmail ?? existingStaff.email,
      existing: {
        email: existingStaff.email,
        portalAccessEnabled: existingStaff.portalAccessEnabled,
        portalPasswordHash: existingStaff.portalPasswordHash,
        portalPasswordSetAt: existingStaff.portalPasswordSetAt,
      },
      portalAccessEnabled,
      portalPassword,
    });
    if ('error' in portalAccess) {
      return NextResponse.json({ error: portalAccess.error }, { status: 400 });
    }

    const normalizedWorkDays = Array.isArray(workDays) ? workDays : existingStaff.workDays;
    const businessHours = await prisma.businessHours.findUnique({
      where: { businessId: session.user.id },
      select: { hours: true },
    });
    const sanitizedWorkHours =
      workHours !== undefined || Array.isArray(workDays)
        ? sanitizeStaffWorkHoursForSave({
            workDays: normalizedWorkDays,
            workHours,
            businessHours: businessHours?.hours,
          })
        : undefined;

    const staff = await prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({
        where: { id },
        data: {
          fullName,
          email: normalizedEmail,
          phone: normalizedPhone,
          role,
          ...(bio !== undefined && { bio: normalizedBio }),
          active: isActive,
          ...portalAccess.data,
          ...(Array.isArray(workDays) && { workDays: normalizedWorkDays }),
          ...(sanitizedWorkHours !== undefined && {
            workHours:
              Object.keys(sanitizedWorkHours).length > 0
                ? sanitizedWorkHours
                : Prisma.JsonNull,
          }),
        },
      });

      // serviceIds present in the body → replace assignments wholesale.
      // serviceIds absent/undefined → leave assignments untouched.
      if (Array.isArray(serviceIds)) {
        await tx.staffService.deleteMany({ where: { staffId: id } });
        if (serviceIds.length > 0) {
          await tx.staffService.createMany({
            data: serviceIds.map((serviceId: string) => ({ staffId: id, serviceId })),
            skipDuplicates: true,
          });
        }
      }

      return tx.staff.findUniqueOrThrow({
        where: { id: updated.id },
        select: STAFF_SELECT,
      });
    });

    const {
      serviceAssignments,
      active,
      workHours: nextWorkHours,
      portalPasswordHash,
      portalPasswordSetAt,
      ...rest
    } = staff;
    revalidateTag(getStaffCacheTag(session.user.id), 'max');
    if (portalAccess.temporaryPassword && staff.email) {
      await sendStaffTemporaryPasswordEmail({
        to: staff.email,
        staffName: staff.fullName,
        businessName: session.user.name || 'your business',
        temporaryPassword: portalAccess.temporaryPassword,
        loginUrl: `${getConfiguredAppBaseUrl()}/login`,
      });
    }

    return NextResponse.json({
      staff: {
        ...rest,
        active,
        isActive: active,
        hasPortalPassword: hasStaffPortalPassword({ portalPasswordHash }),
        passwordChangeRequired: isStaffPasswordChangeRequired({
          portalAccessEnabled: staff.portalAccessEnabled,
          portalPasswordHash,
          portalPasswordSetAt,
        }),
        workHours: normalizeStaffWorkHours(nextWorkHours),
        serviceIds: serviceAssignments.map((a) => a.serviceId),
      },
    });
  } catch (error: any) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 });
  }
}

// DELETE - Delete staff member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.accountType === 'staff') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;

    // Verify staff belongs to this business
    const existingStaff = await prisma.staff.findUnique({ where: { id } });
    if (!existingStaff || existingStaff.businessId !== session.user.id) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Check if staff has any active appointments
    const appointmentCount = await prisma.appointment.count({
      where: {
        staffId: id,
        status: { in: ['scheduled', 'confirmed'] },
      },
    });

    if (appointmentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete staff member with scheduled appointments' },
        { status: 400 }
      );
    }

    // Null out staffId on past appointments/checkins so the FK constraint doesn't block deletion.
    // (Only scheduled/confirmed appointments were blocked above — all others are safe to disassociate.)
    await prisma.$transaction([
      prisma.appointment.updateMany({ where: { staffId: id }, data: { staffId: null } }),
      prisma.checkIn.updateMany({ where: { staffId: id }, data: { staffId: null } }),
      prisma.staff.delete({ where: { id } }),
    ]);

    revalidateTag(getStaffCacheTag(session.user.id), 'max');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 });
  }
}
