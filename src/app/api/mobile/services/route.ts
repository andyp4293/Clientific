import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { formatPhoneForDisplay } from '@/lib/phone';
import { normalizeStaffWorkHours } from '@/lib/staff-schedule';
import { requireMobileSession } from '@/lib/mobile-route';

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
          phoneDisplay: formatPhoneForDisplay(member.phone),
          role: member.role,
          isActive: member.active,
          workDaysLabel: formatWorkDaysLabel(member.workDays),
          workHoursLabel: formatWorkHoursLabel(member.workHours, member.workDays),
          serviceCount: serviceIds.length,
          serviceNames: serviceIds
            .map((serviceId) => serviceNameById.get(serviceId))
            .filter((name): name is string => Boolean(name)),
        };
      }),
    });
  } catch (error) {
    console.error('GET /api/mobile/services error:', error);
    return NextResponse.json({ error: 'Unable to load services and staff' }, { status: 500 });
  }
}
