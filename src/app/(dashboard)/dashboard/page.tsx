import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { startOfMonth, startOfWeek, startOfToday, subDays } from 'date-fns';

async function getDashboardStats(businessId: string) {
  const today = startOfToday();
  const thisWeekStart = startOfWeek(new Date());
  const thisMonthStart = startOfMonth(new Date());
  const last30Days = subDays(new Date(), 30);

  // Total customers
  const totalCustomers = await prisma.customer.count({
    where: { businessId },
  });

  // New customers this month
  const newCustomersThisMonth = await prisma.customer.count({
    where: {
      businessId,
      createdAt: { gte: thisMonthStart },
    },
  });

  // Check-ins today
  const checkInsToday = await prisma.checkIn.count({
    where: {
      businessId,
      checkInTime: { gte: today },
    },
  });

  // Check-ins this week
  const checkInsThisWeek = await prisma.checkIn.count({
    where: {
      businessId,
      checkInTime: { gte: thisWeekStart },
    },
  });

  // Average review rating
  const reviews = await prisma.review.findMany({
    where: { businessId },
    select: { rating: true },
  });
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  // Total reviews
  const totalReviews = reviews.length;

  // Loyalty points issued this month
  const pointsThisMonth = await prisma.pointsTransaction.aggregate({
    where: {
      customer: { businessId },
      createdAt: { gte: thisMonthStart },
      amount: { gt: 0 },
    },
    _sum: { amount: true },
  });

  // Customer segments
  const segments = await prisma.customer.groupBy({
    by: ['segment'],
    where: { businessId },
    _count: true,
  });

  // Recent check-ins
  const recentCheckIns = await prisma.checkIn.findMany({
    where: { businessId },
    orderBy: { checkInTime: 'desc' },
    take: 5,
    include: {
      customer: true,
      service: true,
    },
  });

  // Recent reviews
  const recentReviews = await prisma.review.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      customer: true,
    },
  });

  // Upcoming appointments today
  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      businessId,
      startTime: {
        gte: new Date(),
        lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
      status: { in: ['scheduled', 'confirmed'] },
    },
    orderBy: { startTime: 'asc' },
    take: 5,
    include: {
      customer: true,
      service: true,
    },
  });

  // Check-ins over last 30 days for chart
  const checkInsLast30Days = await prisma.checkIn.groupBy({
    by: ['checkInTime'],
    where: {
      businessId,
      checkInTime: { gte: last30Days },
    },
    _count: true,
  });

  return {
    totalCustomers,
    newCustomersThisMonth,
    checkInsToday,
    checkInsThisWeek,
    avgRating: avgRating.toFixed(1),
    totalReviews,
    pointsThisMonth: pointsThisMonth._sum.amount || 0,
    segments: segments.reduce((acc, s) => {
      acc[s.segment] = s._count;
      return acc;
    }, {} as Record<string, number>),
    recentCheckIns,
    recentReviews,
    upcomingAppointments,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect('/login');
  }

  const business = await prisma.business.findUnique({
    where: { id: session.user.id },
  });

  if (!business) {
    redirect('/login');
  }

  const stats = await getDashboardStats(business.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {business.name}!</p>
      </div>

      {/* Trial Banner */}
      {business.subscriptionStatus === 'trialing' && business.trialEndsAt && (
        <div className="card bg-primary-50 border-primary-200 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-primary-900">Free Trial Active</h3>
              <p className="text-sm text-primary-700 mt-1">
                Your trial ends on {new Date(business.trialEndsAt).toLocaleDateString()}. Upgrade now to continue using ClientFlow.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Total Customers</p>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalCustomers}</p>
          <p className="text-sm text-success mt-1">+{stats.newCustomersThisMonth} this month</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Check-Ins</p>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.checkInsToday}</p>
          <p className="text-sm text-gray-500 mt-1">Today • {stats.checkInsThisWeek} this week</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Avg Rating</p>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.avgRating}</p>
          <p className="text-sm text-gray-500 mt-1">{stats.totalReviews} reviews</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Points Issued</p>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.pointsThisMonth}</p>
          <p className="text-sm text-gray-500 mt-1">This month</p>
        </div>
      </div>      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/dashboard/checkins" className="btn-primary text-center">
            Check In Customer
          </Link>
          <Link href="/dashboard/customers" className="btn-outline text-center">
            Add Customer
          </Link>
          <Link href="/dashboard/appointments" className="btn-outline text-center">
            View Appointments
          </Link>
          <Link href="/dashboard/campaigns" className="btn-outline text-center">
            Send Campaign
          </Link>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Segments */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Customer Segments</h2>
          {Object.keys(stats.segments).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.segments).map(([segment, count]) => {
                const colors: Record<string, string> = {
                  NEW: 'bg-blue-100 text-blue-800',
                  REGULAR: 'bg-green-100 text-green-800',
                  VIP: 'bg-yellow-100 text-yellow-800',
                  AT_RISK: 'bg-orange-100 text-orange-800',
                  CHURNED: 'bg-red-100 text-red-800',
                };
                return (
                  <div key={segment} className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[segment]}`}>
                      {segment.replace('_', ' ')}
                    </span>
                    <span className="text-lg font-semibold text-gray-900">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No customer data yet</p>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Today's Appointments</h2>
          {stats.upcomingAppointments.length > 0 ? (
            <div className="space-y-3">
              {stats.upcomingAppointments.map((apt) => (
                <div key={apt.id} className="flex items-start justify-between border-b border-gray-100 pb-3 last:border-0">                          <div>
                            <p className="font-medium text-gray-900">
                              {apt.customer.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {apt.service?.name || 'No service'}
                            </p>
                          </div>
                  <span className="text-sm font-medium text-gray-700">
                    {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No appointments today</p>
          )}
        </div>

        {/* Recent Check-Ins */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Check-Ins</h2>
          {stats.recentCheckIns.length > 0 ? (
            <div className="space-y-3">
              {stats.recentCheckIns.map((checkin) => (
                <div key={checkin.id} className="flex items-start justify-between border-b border-gray-100 pb-3 last:border-0">                          <div>
                            <p className="font-medium text-gray-900">
                              {checkin.customer.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {checkin.service?.name || 'Walk-in'} • {checkin.pointsEarned} points
                            </p>
                          </div>
                  <span className="text-xs text-gray-500">
                    {new Date(checkin.checkInTime).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No check-ins yet</p>
          )}
        </div>

        {/* Recent Reviews */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Reviews</h2>
          {stats.recentReviews.length > 0 ? (
            <div className="space-y-3">
              {stats.recentReviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-3 last:border-0">                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900">
                      {review.customer.name}
                    </p>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-600 line-clamp-2">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No reviews yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
