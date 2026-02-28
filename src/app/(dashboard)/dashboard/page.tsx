import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { startOfMonth, startOfWeek, startOfToday, subDays } from 'date-fns';
import BookingLinkCard from '@/components/booking/BookingLinkCard';

// Enable Next.js ISR with 60 second revalidation
export const revalidate = 60;

// Convert a local business-timezone date string + hour/minute to UTC
function bizDayBoundary(dateStr: string, hour: number, minute: number, timezone: string): Date {
  const localStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  const naiveUTC = new Date(localStr + 'Z');
  const inBizTz = new Date(naiveUTC.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = naiveUTC.getTime() - inBizTz.getTime();
  return new Date(naiveUTC.getTime() + offsetMs);
}

async function getDashboardStats(businessId: string, timezone: string) {
  const today = startOfToday();
  const thisWeekStart = startOfWeek(new Date());
  const thisMonthStart = startOfMonth(new Date());
  const last30Days = subDays(new Date(), 30);
  // Today's date string in the business's timezone
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // 'YYYY-MM-DD'
  const startOfBizDay = bizDayBoundary(todayStr, 0, 0, timezone);
  const endOfBizDay = new Date(startOfBizDay.getTime() + 24 * 60 * 60 * 1000 - 1);

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
    },  });
  
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
    },  });

  // All appointments today (full business-timezone day, including pending)
  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      businessId,
      startTime: {
        gte: startOfBizDay,
        lte: endOfBizDay,
      },
      status: { in: ['pending', 'scheduled', 'confirmed'] },
    },
    orderBy: { startTime: 'asc' },
    take: 10,
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
    pointsThisMonth: pointsThisMonth._sum.amount || 0,
    segments: segments.reduce((acc: Record<string, number>, s: any) => {
      acc[s.segment] = s._count;
      return acc;
    }, {} as Record<string, number>),
    recentCheckIns,
    upcomingAppointments,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const business = await prisma.business.findUnique({
    where: { id: session.user.id },
  });

  if (!business) {
    redirect('/signout');
  }

  const params = await searchParams;
  const checkoutSuccess = params.checkout === 'success';
  const stats = await getDashboardStats(business.id, business.timezone);

  // Calculate trial days remaining
  const trialDaysRemaining = business.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(business.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const isTrialUrgent = trialDaysRemaining !== null && trialDaysRemaining <= 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome back, {business.name}!</p>
      </div>

      {/* Checkout success toast */}
      {checkoutSuccess && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-200">You&apos;re subscribed!</p>
            <p className="text-sm text-green-700 dark:text-green-300">Your plan is now active. You&apos;re all set.</p>
          </div>
        </div>
      )}

      {/* Subscription status banners — hidden when active or just subscribed */}
      {!checkoutSuccess && business.subscriptionStatus !== 'active' && (
        <>
          {/* Trial banner */}
          {business.subscriptionStatus === 'trialing' && trialDaysRemaining !== null && (
            <div className={`rounded-lg border p-4 flex items-center justify-between gap-4 ${
              isTrialUrgent
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <div className="flex items-start gap-3">
                <svg className={`w-5 h-5 shrink-0 mt-0.5 ${isTrialUrgent ? 'text-red-500' : 'text-yellow-500 dark:text-yellow-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className={`text-sm font-semibold ${isTrialUrgent ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
                    {isTrialUrgent
                      ? `Trial expires in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}`
                      : `${trialDaysRemaining} days left in your free trial`}
                  </p>
                  <p className={`text-sm ${isTrialUrgent ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                    Subscribe now to keep your data and stay uninterrupted.
                  </p>
                </div>
              </div>
              <Link
                href="/pricing"
                className={`shrink-0 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                  isTrialUrgent
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                }`}
              >
                Choose a plan
              </Link>
            </div>
          )}

          {/* Past due banner */}
          {business.subscriptionStatus === 'past_due' && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">Payment failed</p>
                  <p className="text-sm text-red-700 dark:text-red-300">Please update your payment method to avoid service interruption.</p>
                </div>
              </div>
              <Link href="/dashboard/settings/billing" className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                Fix payment
              </Link>
            </div>
          )}

          {/* Canceled banner */}
          {business.subscriptionStatus === 'canceled' && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">Subscription canceled</p>
                  <p className="text-sm text-red-700 dark:text-red-300">Your subscription has ended. Reactivate to continue using ClientFlow.</p>
                </div>
              </div>
              <Link href="/pricing" className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                Reactivate
              </Link>
            </div>
          )}
        </>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Customers</p>
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalCustomers}</p>
          <p className="text-sm text-success mt-1">+{stats.newCustomersThisMonth} this month</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Check-Ins</p>
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.checkInsToday}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Today • {stats.checkInsThisWeek} this week</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Points Issued</p>
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.pointsThisMonth}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This month</p>
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

      {/* Booking Link Card */}
      <BookingLinkCard />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Segments */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Customer Segments</h2>          {Object.keys(stats.segments).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.segments).map(([segment, count]: [string, number]) => {
                const colors: Record<string, string> = {
                  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
                  REGULAR: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
                  VIP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
                  AT_RISK: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
                  CHURNED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
                };
                return (
                  <div key={segment} className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[segment]}`}>
                      {segment.replace('_', ' ')}
                    </span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No customer data yet</p>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Today's Appointments</h2>          {stats.upcomingAppointments.length > 0 ? (
            <div className="space-y-3">
              {stats.upcomingAppointments.map((apt: any) => (
                <div key={apt.id} className="flex items-start justify-between border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0">                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {apt.customer.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {apt.service?.name || 'No service'}
                            </p>
                          </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {new Date(apt.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: business.timezone })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No appointments today</p>
          )}
        </div>

        {/* Recent Check-Ins */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Check-Ins</h2>          {stats.recentCheckIns.length > 0 ? (
            <div className="space-y-3">
              {stats.recentCheckIns.map((checkin: any) => (
                <div key={checkin.id} className="flex items-start justify-between border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0">                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {checkin.customer.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {checkin.service?.name || 'Walk-in'} • {checkin.pointsEarned} points
                            </p>
                          </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(checkin.checkInTime).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No check-ins yet</p>
          )}
        </div>

      </div>
    </div>
  );
}
