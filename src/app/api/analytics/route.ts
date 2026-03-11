import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '30d';
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const rangeStart = new Date(Date.now() - days * 86400000);

    // Run all queries in parallel
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
        where: { businessId, checkInTime: { gte: rangeStart } },
        _sum: { amountSpent: true },
      }),
      prisma.appointment.count({
        where: { businessId, createdAt: { gte: rangeStart } },
      }),
      prisma.customer.count({
        where: { businessId, createdAt: { gte: rangeStart } },
      }),
      prisma.checkIn.findMany({
        where: { businessId, checkInTime: { gte: rangeStart } },
        select: { checkInTime: true, amountSpent: true },
        orderBy: { checkInTime: 'asc' },
      }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: { businessId, createdAt: { gte: rangeStart } },
        _count: true,
      }),
      prisma.appointment.groupBy({
        by: ['serviceId'],
        where: { businessId, createdAt: { gte: rangeStart } },
        _count: true,
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5,
      }),
      prisma.service.findMany({
        where: { businessId },
        select: { id: true, name: true },
      }),
      prisma.customer.groupBy({
        by: ['segment'],
        where: { businessId },
        _count: true,
      }),
    ]);

    const totalRevenue = revenueAgg._sum.amountSpent ?? 0;
    const avgRevenuePerVisit = allCheckIns.length > 0 ? totalRevenue / allCheckIns.length : 0;

    // Bucket check-ins into weekly bins
    const bucketCount = Math.ceil(days / 7);
    const revenueByWeek: { label: string; revenue: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = new Date(rangeStart.getTime() + i * 7 * 86400000);
      const bucketEnd = new Date(bucketStart.getTime() + 7 * 86400000);
      const label = bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const revenue = allCheckIns
        .filter((c) => c.checkInTime >= bucketStart && c.checkInTime < bucketEnd)
        .reduce((sum, c) => sum + (c.amountSpent ?? 0), 0);
      revenueByWeek.push({ label, revenue: Math.round(revenue * 100) / 100 });
    }

    // Map service IDs to names
    const serviceMap = Object.fromEntries(services.map((s) => [s.id, s.name]));
    const topServices = appointmentsByService
      .filter((a) => a.serviceId)
      .map((a) => ({
        name: serviceMap[a.serviceId!] ?? 'Unknown',
        count: a._count,
      }));

    return NextResponse.json({
      stats: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalAppointments,
        newCustomers,
        avgRevenuePerVisit: Math.round(avgRevenuePerVisit * 100) / 100,
      },
      revenueByWeek,
      appointmentsByStatus: appointmentsByStatus.map((a) => ({
        status: a.status,
        count: a._count,
      })),
      topServices,
      customerSegments: customerSegments.map((s) => ({
        segment: s.segment,
        count: s._count,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
