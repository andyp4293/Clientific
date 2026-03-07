import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { startOfMonth, startOfWeek, startOfToday, subDays } from 'date-fns';
import BookingLinkCard from '@/components/booking/BookingLinkCard';
import { localToUTC } from '@/lib/timezone';

// Enable Next.js ISR with 60 second revalidation
export const revalidate = 60;

const bizDayBoundary = localToUTC;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Welcome back, {business.name}</p>
        </div>
        <Link href="/dashboard/appointments/new" className="btn-primary text-sm px-4 py-2 hidden sm:inline-flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Appointment
        </Link>
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
                  <p className="text-sm text-red-700 dark:text-red-300">Your subscription has ended. Reactivate to continue using Clientific.</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 flex items-center gap-4 border-l-4 border-l-primary">
          <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Customers</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{stats.totalCustomers}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">+{stats.newCustomersThisMonth} this month</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Appts Today</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{stats.upcomingAppointments.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">scheduled</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4 border-l-4 border-l-emerald-500">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Check-Ins</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{stats.checkInsToday}</p>
            <p className="text-xs text-gray-400 mt-0.5">Today · {stats.checkInsThisWeek} this week</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Points Issued</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{stats.pointsThisMonth}</p>
            <p className="text-xs text-gray-400 mt-0.5">This month</p>
          </div>
        </div>
      </div>      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/appointments/new', label: 'New Appointment', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20' },
            { href: '/dashboard/customers', label: 'Add Customer', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20' },
            { href: '/dashboard/appointments', label: 'View Schedule', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' },
            { href: '/dashboard/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20' },
          ].map(action => (
            <Link key={action.label} href={action.href} className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${action.color}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={action.icon} />
              </svg>
              <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Booking Link Card */}
      <BookingLinkCard />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Segments */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Customer Segments</h2>
            <Link href="/dashboard/customers" className="text-xs text-primary hover:text-primary-700 font-medium">View all →</Link>
          </div>
          {Object.keys(stats.segments).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.segments).map(([segment, count]: [string, number]) => {
                const config: Record<string, { label: string; bar: string; badge: string }> = {
                  NEW:      { label: 'New',      bar: 'bg-blue-500',   badge: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300' },
                  REGULAR:  { label: 'Regular',  bar: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
                  VIP:      { label: 'VIP',      bar: 'bg-amber-500',  badge: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
                  AT_RISK:  { label: 'At Risk',  bar: 'bg-orange-500', badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300' },
                  CHURNED:  { label: 'Churned',  bar: 'bg-red-500',    badge: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300' },
                };
                const cfg = config[segment] || { label: segment, bar: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700' };
                const total = Object.values(stats.segments).reduce((a: number, b: number) => a + b, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={segment} className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-20 text-center shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums w-6 text-right shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">No customer data yet</p>
              <Link href="/dashboard/customers" className="mt-3 text-xs text-primary hover:text-primary-700 font-medium">Add customers →</Link>
            </div>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Today&apos;s Appointments</h2>
            <Link href="/dashboard/appointments" className="text-xs text-primary hover:text-primary-700 font-medium">View all →</Link>
          </div>
          {stats.upcomingAppointments.length > 0 ? (
            <div className="space-y-2">
              {stats.upcomingAppointments.map((apt: any) => {
                const initials = apt.customer.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                const time = new Date(apt.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: business.timezone });
                return (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/15 dark:bg-primary/25 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{apt.customer.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{apt.service?.name || 'No service'}</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-md shrink-0">{time}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">No appointments today</p>
              <Link href="/dashboard/appointments/new" className="mt-3 text-xs text-primary hover:text-primary-700 font-medium">Schedule one →</Link>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
