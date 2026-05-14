import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { formatPhoneForDisplay } from '@/lib/phone';
import { normalizeStaffWorkHours } from '@/lib/staff-schedule';
import { requireMobileSession } from '@/lib/mobile-route';
import { hasStaffPortalPassword } from '@/lib/staff-portal-access';
import { requireActiveSubscription, checkPlanLimit } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import {
  getServiceGroupsCacheTag,
  getServicesCacheTag,
} from '@/lib/cache-tags';
import { revalidateTag } from 'next/cache';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return 'Custom price';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDuration(duration: number) {
  if (duration < 60) {
    return `${duration} min`;
  }

  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
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

export async function GET(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: authorized.session.businessId },
      select: {
        id: true,
        email: true,
        name: true,
        businessType: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [groups, services, staff] = await Promise.all([
      prisma.serviceGroup.findMany({
        where: { businessId: business.id },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { _count: { select: { services: true } } },
      }),
      prisma.service.findMany({
        where: { businessId: business.id },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.staff.findMany({
        where: { businessId: business.id },
        orderBy: { fullName: 'asc' },
        include: {
          serviceAssignments: {
            select: { serviceId: true },
          },
        },
      }),
    ]);

    const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
    const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      counts: {
        services: services.length,
        activeServices: services.filter((service) => service.active).length,
        staff: staff.length,
        activeStaff: staff.filter((member) => member.active).length,
      },
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        sortOrder: group.sortOrder,
        servicesCount: group._count.services,
      })),
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        duration: service.duration,
        durationLabel: formatDuration(service.duration),
        price: service.price,
        priceLabel: formatCurrency(service.price),
        isActive: service.active,
        groupId: service.groupId,
        groupName: service.groupId ? groupNameById.get(service.groupId) ?? null : null,
        sortOrder: service.sortOrder,
      })),
      staff: staff.map((member) => {
        const serviceIds = member.serviceAssignments.map((assignment) => assignment.serviceId);

        return {
          id: member.id,
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          phoneDisplay: formatPhoneForDisplay(member.phone),
          role: member.role,
          bio: member.bio,
          isActive: member.active,
          portalAccessEnabled: member.portalAccessEnabled,
          hasPortalPassword: hasStaffPortalPassword(member),
          workDays: member.workDays,
          workHours: normalizeStaffWorkHours(member.workHours),
          workDaysLabel: formatWorkDaysLabel(member.workDays),
          workHoursLabel: formatWorkHoursLabel(member.workHours, member.workDays),
          serviceCount: serviceIds.length,
          serviceIds,
          serviceNames: serviceIds
            .map((serviceId: string) => serviceNameById.get(serviceId))
            .filter((name: string | undefined): name is string => Boolean(name)),
        };
      }),
    });
  } catch (error) {
    console.error('GET /api/mobile/services error:', error);
    return NextResponse.json({ error: 'Unable to load services and staff' }, { status: 500 });
  }
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

    const limitCheck = await checkPlanLimit(authorized.session.businessId, 'services');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Service limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan.`,
          code: 'PLAN_LIMIT_REACHED',
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body?.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : null;
    const duration = Number.parseInt(String(body?.duration ?? ''), 10);
    const price =
      body?.price === null || body?.price === undefined || body?.price === ''
        ? null
        : Number.parseFloat(String(body.price));
    const isActive = body?.isActive !== false;
    const groupId = typeof body?.groupId === 'string' && body.groupId.trim().length > 0
      ? body.groupId.trim()
      : null;

    if (!name || !Number.isFinite(duration)) {
      return NextResponse.json({ error: 'Name and duration are required' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Service name', value: name },
      { label: 'Service description', value: description },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (duration < 5) {
      return NextResponse.json({ error: 'Duration must be at least 5 minutes' }, { status: 400 });
    }

    if (body?.price !== undefined && body?.price !== null && body?.price !== '' && !Number.isFinite(price ?? Number.NaN)) {
      return NextResponse.json({ error: 'Price must be a valid number' }, { status: 400 });
    }

    if (groupId) {
      const group = await prisma.serviceGroup.findFirst({
        where: {
          id: groupId,
          businessId: authorized.session.businessId,
        },
        select: { id: true },
      });

      if (!group) {
        return NextResponse.json({ error: 'Service group not found' }, { status: 400 });
      }
    }

    const maxSort = await prisma.service.aggregate({
      where: { businessId: authorized.session.businessId },
      _max: { sortOrder: true },
    });

    const service = await prisma.service.create({
      data: {
        businessId: authorized.session.businessId,
        name,
        description,
        duration,
        price: Number.isFinite(price ?? Number.NaN) ? price : null,
        active: isActive,
        groupId,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    revalidateTag(getServicesCacheTag(authorized.session.businessId), 'max');
    revalidateTag(getServiceGroupsCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json(
      {
        service: {
          id: service.id,
          name: service.name,
          description: service.description,
          duration: service.duration,
          durationLabel: formatDuration(service.duration),
          price: service.price,
          priceLabel: formatCurrency(service.price),
          isActive: service.active,
          groupId: service.groupId,
          groupName: null,
          sortOrder: service.sortOrder,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/mobile/services error:', error);
    return NextResponse.json({ error: 'Unable to create service' }, { status: 500 });
  }
}
