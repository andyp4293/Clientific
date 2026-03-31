import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { requireMobileSession } from '@/lib/mobile-route';

type Range = '7d' | '30d' | '90d';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatAppointmentStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatSegmentLabel(segment: string) {
  return segment
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
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

    const searchParams = new URL(request.url).searchParams;
    const rangeParam = searchParams.get('range');
    const range: Range = rangeParam === '7d' || rangeParam === '90d' ? rangeParam : '30d';
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const rangeStart = new Date(Date.now() - days * 86400000);

    const [
      revenueAgg,
      totalAppointments,
      newCustomers,
      allCheckIns,
      appointmentsByStatus,
      appointmentsByService,
      services,
      customerSegments,
    ] = await Promise.all([
      prisma.checkIn.aggregate({
        where: { businessId: business.id, checkInTime: { gte: rangeStart } },
        _sum: { amountSpent: true },
      }),
      prisma.appointment.count({
        where: { businessId: business.id, createdAt: { gte: rangeStart } },
      }),
      prisma.customer.count({
        where: { businessId: business.id, createdAt: { gte: rangeStart } },
      }),
      prisma.checkIn.findMany({
        where: { businessId: business.id, checkInTime: { gte: rangeStart } },
        select: { checkInTime: true, amountSpent: true },
        orderBy: { checkInTime: 'asc' },
      }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: { businessId: business.id, createdAt: { gte: rangeStart } },
        _count: true,
      }),
      prisma.appointment.groupBy({
        by: ['serviceId'],
        where: { businessId: business.id, createdAt: { gte: rangeStart } },
        _count: true,
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5,
      }),
      prisma.service.findMany({
        where: { businessId: business.id },
        select: { id: true, name: true },
      }),
      prisma.customer.groupBy({
        by: ['segment'],
        where: { businessId: business.id },
        _count: true,
      }),
    ]);

    const totalRevenue = Math.round((revenueAgg._sum.amountSpent ?? 0) * 100) / 100;
    const avgRevenuePerVisit = allCheckIns.length > 0 ? totalRevenue / allCheckIns.length : 0;
    const serviceMap = Object.fromEntries(services.map((service) => [service.id, service.name]));
    const maxServiceCount = appointmentsByService[0]?._count ?? 1;
    const bucketCount = Math.ceil(days / 7);

    const revenueByWeek = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(rangeStart.getTime() + index * 7 * 86400000);
      const bucketEnd = new Date(bucketStart.getTime() + 7 * 86400000);
      const label = bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const revenue = allCheckIns
        .filter((checkIn) => checkIn.checkInTime >= bucketStart && checkIn.checkInTime < bucketEnd)
        .reduce((sum, checkIn) => sum + (checkIn.amountSpent ?? 0), 0);

      return {
        label,
        revenue: Math.round(revenue * 100) / 100,
        revenueLabel: formatCurrency(revenue),
      };
    });

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      range,
      stats: {
        totalRevenue,
        totalRevenueLabel: formatCurrency(totalRevenue),
        totalAppointments,
        newCustomers,
        avgRevenuePerVisit: Math.round(avgRevenuePerVisit * 100) / 100,
        avgRevenuePerVisitLabel: formatCurrency(avgRevenuePerVisit),
      },
      revenueByWeek,
      appointmentsByStatus: appointmentsByStatus.map((appointment) => ({
        status: appointment.status,
        label: formatAppointmentStatus(appointment.status),
        count: appointment._count,
      })),
      topServices: appointmentsByService
        .filter((appointment) => appointment.serviceId)
        .map((appointment) => ({
          name: serviceMap[appointment.serviceId!] ?? 'Unknown',
          count: appointment._count,
          share: Math.round((appointment._count / maxServiceCount) * 100),
        })),
      customerSegments: customerSegments.map((segment) => ({
        segment: segment.segment,
        label: formatSegmentLabel(segment.segment),
        count: segment._count,
      })),
    });
  } catch (error) {
    console.error('GET /api/mobile/analytics error:', error);
    return NextResponse.json({ error: 'Unable to load analytics' }, { status: 500 });
  }
}
