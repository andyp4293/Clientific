import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { startOfMonth, startOfWeek, startOfToday } from 'date-fns';
import BookingLinkCard from '@/components/booking/BookingLinkCard';
import { localToUTC } from '@/lib/timezone';
import { unstable_cache } from 'next/cache';
import {
  collectAppointmentServiceIds,
  withAppointmentServiceDisplay,
} from '@/lib/appointment-services';

const bizDayBoundary = localToUTC;

const QUICK_ACTIONS = [
  {
    href: '/dashboard/appointments/new',
    label: 'New Appointment',
    helper: 'Book a visit fast',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/dashboard/customers',
    label: 'Add Customer',
    helper: 'Create a profile',
    icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  },
  {
    href: '/dashboard/appointments',
    label: 'View Schedule',
    helper: 'See today at a glance',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    href: '/dashboard/analytics',
    label: 'Analytics',
    helper: 'Track performance',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
] as const;

async function getDashboardStats(businessId: string, timezone: string) {
  const today = startOfToday();
  const thisWeekStart = startOfWeek(new Date());
  const thisMonthStart = startOfMonth(new Date());
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  const startOfBizDay = bizDayBoundary(todayStr, 0, 0, timezone);
  const endOfBizDay = new Date(startOfBizDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const [
    totalCustomers,
    newCustomersThisMonth,
    checkInsToday,
    checkInsThisWeek,
    segments,
    upcomingAppointments,
  ] = await Promise.all([
    prisma.customer.count({ where: { businessId } }),
    prisma.customer.count({ where: { businessId, createdAt: { gte: thisMonthStart } } }),
    prisma.checkIn.count({ where: { businessId, checkInTime: { gte: today } } }),
    prisma.checkIn.count({ where: { businessId, checkInTime: { gte: thisWeekStart } } }),
    prisma.customer.groupBy({ by: ['segment'], where: { businessId }, _count: true }),
    prisma.appointment.findMany({
      where: {
        businessId,
        startTime: { gte: startOfBizDay, lte: endOfBizDay },
        status: { in: ['pending', 'scheduled', 'confirmed'] },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
      include: { customer: true, service: true },
    }),
  ]);

  const appointmentServiceIds = collectAppointmentServiceIds(upcomingAppointments);
  const appointmentServices = appointmentServiceIds.length > 0
    ? await prisma.service.findMany({
        where: { id: { in: appointmentServiceIds } },
        select: { id: true, name: true },
      })
    : [];
  const upcomingAppointmentsWithServices = withAppointmentServiceDisplay(
    upcomingAppointments,
    appointmentServices,
  );

  return {
    totalCustomers,
    newCustomersThisMonth,
    checkInsToday,
    checkInsThisWeek,
    segments: segments.reduce((acc: Record<string, number>, segment) => {
      acc[segment.segment] = segment._count;
      return acc;
    }, {} as Record<string, number>),
    upcomingAppointments: upcomingAppointmentsWithServices,
  };
}

function getCachedDashboardStats(businessId: string, timezone: string) {
  return unstable_cache(
    () => getDashboardStats(businessId, timezone),
    [`dashboard-stats-${businessId}`],
    { tags: [`dashboard-stats-${businessId}`], revalidate: 30 },
  )();
}

function getCachedBusiness(businessId: string) {
  return unstable_cache(
    () => prisma.business.findUnique({ where: { id: businessId } }),
    [`business-${businessId}`],
    { tags: [`business-${businessId}`], revalidate: 60 },
  )();
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

  const [business, params] = await Promise.all([
    getCachedBusiness(session.user.id),
    searchParams,
  ]);

  if (!business) {
    redirect('/signout');
  }

  const checkoutSuccess = params.checkout === 'success';
  const stats = await getCachedDashboardStats(business.id, business.timezone);
  const needsOnboarding =
    !business.phone || !business.street || !business.city || !business.state || !business.zipCode;

  const trialDaysRemaining = business.trialEndsAt
    ? Math.max(
        0,
        Math.ceil((new Date(business.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      )
    : null;

  const isTrialUrgent = trialDaysRemaining !== null && trialDaysRemaining <= 3;

  const dashboardStats = [
    {
      label: 'Customers',
      value: stats.totalCustomers,
      helper: `+${stats.newCustomersThisMonth} this month`,
      accent: 'from-primary/16 via-primary/6 to-transparent',
      iconBg: 'bg-primary/10 dark:bg-primary/18',
      icon:
        'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    },
    {
      label: 'Appointments Today',
      value: stats.upcomingAppointments.length,
      helper: 'Scheduled',
      accent: 'from-primary/12 via-primary/5 to-transparent',
      iconBg: 'bg-primary/10 dark:bg-primary/18',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      label: 'Check-Ins',
      value: stats.checkInsToday,
      helper: `${stats.checkInsThisWeek} this week`,
      accent: 'from-primary/10 via-primary/4 to-transparent',
      iconBg: 'bg-primary/10 dark:bg-primary/18',
      icon:
        'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    },
    {
      label: 'New Customers',
      value: stats.newCustomersThisMonth,
      helper: 'This month',
      accent: 'from-primary/12 via-primary/5 to-transparent',
      iconBg: 'bg-primary/10 dark:bg-primary/18',
      icon:
        'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
    },
  ] as const;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-[2.15rem]">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
          Welcome back, {business.name}
        </p>
      </div>

      {checkoutSuccess && (
        <div className="rounded-[24px] border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                You&apos;re subscribed!
              </p>
              <p className="mt-1 text-sm leading-6 text-green-700 dark:text-green-300">
                Your plan is now active. You&apos;re all set.
              </p>
            </div>
          </div>
        </div>
      )}

      {needsOnboarding && (
        <div className="rounded-[26px] border border-blue-200 bg-blue-50/95 p-4 shadow-sm dark:border-blue-800 dark:bg-blue-900/20 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Finish your business setup
                </p>
                <p className="mt-1 text-sm leading-6 text-blue-700 dark:text-blue-300">
                  Add your phone and business location so your profile, booking flow, and local
                  campaigns are fully configured.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/onboarding"
              className="btn-primary w-full justify-center rounded-xl px-4 py-3 text-sm sm:w-auto"
            >
              Finish setup
            </Link>
          </div>
        </div>
      )}

      {!checkoutSuccess && business.subscriptionStatus !== 'active' && (
        <>
          {business.subscriptionStatus === 'trialing' && trialDaysRemaining !== null && (
            <section
              data-testid="dashboard-trial-banner"
              className={`rounded-[28px] border p-4 shadow-sm sm:p-5 ${
                isTrialUrgent
                  ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                  : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      isTrialUrgent
                        ? 'bg-red-100 dark:bg-red-900/35'
                        : 'bg-yellow-100 dark:bg-yellow-900/35'
                    }`}
                  >
                    <svg
                      className={`h-5 w-5 ${
                        isTrialUrgent
                          ? 'text-red-500'
                          : 'text-yellow-600 dark:text-yellow-300'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-lg font-semibold leading-tight ${
                        isTrialUrgent
                          ? 'text-red-800 dark:text-red-200'
                          : 'text-yellow-800 dark:text-yellow-200'
                      }`}
                    >
                      {isTrialUrgent
                        ? `Trial expires in ${trialDaysRemaining} day${
                            trialDaysRemaining === 1 ? '' : 's'
                          }`
                        : `${trialDaysRemaining} days left in your free trial`}
                    </p>
                    <p
                      className={`mt-1 text-sm leading-6 ${
                        isTrialUrgent
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-yellow-700 dark:text-yellow-300'
                      }`}
                    >
                      Subscribe now to keep your data and stay uninterrupted.
                    </p>
                  </div>
                </div>
                <Link
                  href="/pricing"
                  className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors sm:w-auto ${
                    isTrialUrgent
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  }`}
                >
                  Choose a plan
                </Link>
              </div>
            </section>
          )}

          {business.subscriptionStatus === 'past_due' && (
            <div className="rounded-[28px] border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800 dark:bg-red-900/20 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/35">
                    <svg
                      className="h-5 w-5 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-red-800 dark:text-red-200">
                      Payment failed
                    </p>
                    <p className="mt-1 text-sm leading-6 text-red-700 dark:text-red-300">
                      Please update your payment method to avoid service interruption.
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/settings/billing"
                  className="w-full rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-red-700 sm:w-auto"
                >
                  Fix payment
                </Link>
              </div>
            </div>
          )}

          {business.subscriptionStatus === 'canceled' && (
            <div className="rounded-[28px] border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800 dark:bg-red-900/20 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/35">
                    <svg
                      className="h-5 w-5 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-red-800 dark:text-red-200">
                      Subscription canceled
                    </p>
                    <p className="mt-1 text-sm leading-6 text-red-700 dark:text-red-300">
                      Your subscription has ended. Reactivate to continue using Clientific.
                    </p>
                  </div>
                </div>
                <Link
                  href="/pricing"
                  className="w-full rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-red-700 sm:w-auto"
                >
                  Reactivate
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      <section
        data-testid="dashboard-stat-grid"
        className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4"
      >
        {dashboardStats.map((stat) => (
          <div
            key={stat.label}
            data-testid="dashboard-stat-card"
            className="card relative overflow-hidden rounded-[28px] p-5 sm:p-6"
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stat.accent}`} />
            <div className="relative flex h-full min-h-[158px] flex-col justify-between gap-6">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                  {stat.label}
                </p>
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${stat.iconBg}`}
                >
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.9}
                      d={stat.icon}
                    />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-4xl font-bold leading-none text-gray-900 tabular-nums dark:text-gray-100 sm:text-[2.6rem]">
                  {stat.value}
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-gray-600 dark:text-gray-300">
                  {stat.helper}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card rounded-[30px] p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Move faster through the tasks you use most.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex items-center justify-between gap-3 rounded-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 p-4 text-left text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary-50/70 hover:shadow-lg hover:shadow-primary/5 dark:border-gray-700 dark:text-gray-200 dark:hover:border-primary/35 dark:hover:bg-gray-800/85"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/18">
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d={action.icon}
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {action.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {action.helper}
                  </p>
                </div>
              </div>
              <svg
                className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      <BookingLinkCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Customer Segments
            </h2>
            <Link
              href="/dashboard/customers"
              className="text-xs font-medium text-primary hover:text-primary-700"
            >
              View all -&gt;
            </Link>
          </div>
          {Object.keys(stats.segments).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.segments).map(([segment, count]: [string, number]) => {
                const config: Record<
                  string,
                  { label: string; bar: string; badge: string }
                > = {
                  NEW: {
                    label: 'New',
                    bar: 'bg-primary-300',
                    badge:
                      'bg-primary-50 text-primary-700 dark:bg-primary/10 dark:text-primary-300',
                  },
                  REGULAR: {
                    label: 'Regular',
                    bar: 'bg-primary-500',
                    badge:
                      'bg-primary-50 text-primary-700 dark:bg-primary/12 dark:text-primary-300',
                  },
                  VIP: {
                    label: 'VIP',
                    bar: 'bg-primary-700',
                    badge:
                      'bg-primary-100 text-primary-800 dark:bg-primary/16 dark:text-primary-200',
                  },
                  AT_RISK: {
                    label: 'At Risk',
                    bar: 'bg-orange-500',
                    badge:
                      'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
                  },
                  CHURNED: {
                    label: 'Churned',
                    bar: 'bg-red-500',
                    badge: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
                  },
                };
                const cfg = config[segment] || {
                  label: segment,
                  bar: 'bg-gray-400',
                  badge: 'bg-gray-100 text-gray-700',
                };
                const total = Object.values(stats.segments).reduce(
                  (accumulator: number, current: number) => accumulator + current,
                  0,
                );
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div key={segment} className="flex items-center gap-3">
                    <span
                      className={`w-20 shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-semibold ${cfg.badge}`}
                    >
                      {cfg.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className={`h-full rounded-full ${cfg.bar}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">No customer data yet</p>
              <Link
                href="/dashboard/customers"
                className="mt-3 text-xs font-medium text-primary hover:text-primary-700"
              >
                Add customers -&gt;
              </Link>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Today&apos;s Appointments
            </h2>
            <Link
              href="/dashboard/appointments"
              className="text-xs font-medium text-primary hover:text-primary-700"
            >
              View all -&gt;
            </Link>
          </div>
          {stats.upcomingAppointments.length > 0 ? (
            <div className="space-y-2">
              {stats.upcomingAppointments.map((appointment: any) => {
                const initials = appointment.customer.name
                  .split(' ')
                  .map((part: string) => part[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
                const time = new Date(appointment.startTime).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: business.timezone,
                });

                return (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 dark:bg-primary/25">
                      <span className="text-xs font-bold text-primary">{initials}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {appointment.customer.name}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {appointment.serviceDisplayName || appointment.service?.name || 'No service'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {time}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">No appointments today</p>
              <Link
                href="/dashboard/appointments/new"
                className="mt-3 text-xs font-medium text-primary hover:text-primary-700"
              >
                Schedule one -&gt;
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
