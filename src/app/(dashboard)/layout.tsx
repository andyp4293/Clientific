import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { APP_NAME } from '@/lib/brand';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { MobileOverlayChromeWatcher } from '@/components/layout/MobileOverlayChromeWatcher';
import { SubscriptionBanner } from '@/components/billing/SubscriptionBanner';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { ClientificLogo } from '@/components/brand/ClientificLogo';
import { PRICING_PLANS, VISIBLE_SELF_SERVE_PLAN_KEYS } from '@/lib/pricing-plans';
import { isSubscriptionAccessActive } from '@/lib/subscription';
import { Toaster } from 'sonner';

type DashboardBusinessSnapshot = {
  id: string;
  name: string;
  email: string;
  businessEmail: string | null;
  logoUrl: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  subscriptionCurrentPeriodEnd: Date | null;
};

async function loadDashboardBusiness(
  businessId: string
): Promise<DashboardBusinessSnapshot | null> {
  try {
    return await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        email: true,
        businessEmail: true,
        logoUrl: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionCurrentPeriodEnd: true,
      },
    });
  } catch (error) {
    // Retry once to smooth over transient Neon/Prisma connection blips.
    await new Promise((resolve) => setTimeout(resolve, 150));

    return prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        email: true,
        businessEmail: true,
        logoUrl: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionCurrentPeriodEnd: true,
      },
    });
  }
}

function DashboardUnavailable({
  retryHref,
}: {
  retryHref: string;
}) {
  return (
    <div className="min-h-screen brand-shell">
      <header className="fixed top-0 left-0 right-0 h-14 z-50 brand-panel border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center space-x-2">
          <ClientificLogo
            className="flex items-center gap-2"
            markClassName="h-7 w-7 text-gray-950 dark:text-white"
            nameClassName="text-lg font-bold text-gray-900 dark:text-gray-100"
            title={APP_NAME}
          />
        </Link>
        <Link
          href="/signout"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Sign out
        </Link>
      </header>

      <main className="pt-24 px-4 pb-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
              />
            </svg>
          </div>

          <h1 className="mt-5 text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard temporarily unavailable
          </h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            We couldn&apos;t reach your business data just now. This usually clears up quickly, so
            try again in a moment.
          </p>

          <div className="mt-6 space-y-3">
            <Link href={retryHref} className="btn-primary block w-full">
              Try again
            </Link>
            <Link href="/" className="btn-outline block w-full">
              Go to homepage
            </Link>
          </div>
        </div>
      </main>

      <Toaster richColors position="top-right" />
    </div>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signout');
  }

  if (session.user.accountType === 'staff') {
    redirect('/staff/appointments');
  }

  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';
  const isOnboardingPage = pathname === '/dashboard/onboarding';
  const isSubscribePage = pathname === '/dashboard/subscribe';
  const isReferralCollectionPage =
    pathname === '/dashboard/referrals' ||
    pathname === '/dashboard/payouts' ||
    pathname === '/dashboard/payouts/setup';
  const showSubscriptionBanner = pathname !== '/dashboard';
  const businessId = session.user.businessId ?? session.user.id;

  if (!businessId) {
    redirect('/signout');
  }

  let business: DashboardBusinessSnapshot | null = null;
  let businessLoadFailed = false;

  try {
    business = await loadDashboardBusiness(businessId);
  } catch (error) {
    businessLoadFailed = true;
    console.error('Dashboard layout failed to load business:', error);
    if (!isSubscribePage) {
      return <DashboardUnavailable retryHref={pathname || '/dashboard'} />;
    }
  }

  if (!business && !businessLoadFailed) {
    redirect('/signout');
  }

  if (business) {
    const hasActiveSubscription = isSubscriptionAccessActive(
      business.subscriptionStatus,
      business.trialEndsAt,
      business.subscriptionCurrentPeriodEnd,
    );
    const onboardingComplete = isBusinessOnboardingComplete(business);

    if (!isSubscribePage && !hasActiveSubscription && !isReferralCollectionPage) {
      redirect('/dashboard/subscribe');
    }

    if (hasActiveSubscription) {
      if (!onboardingComplete && !isOnboardingPage) {
        redirect('/dashboard/onboarding');
      }

      if (onboardingComplete && isOnboardingPage) {
        redirect('/dashboard');
      }
    }
  }

  // Locked layout for onboarding and subscribe - no nav, no sidebar, just logo + sign out.
  if (isSubscribePage || isOnboardingPage) {
    const lowestMonthlyPrice = Math.min(
      ...VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => PRICING_PLANS[key].price)
    );
    const title = isOnboardingPage ? 'Finish setup' : 'Complete subscription';
    const subtitle = isOnboardingPage
      ? 'Add your business phone and location before the dashboard unlocks.'
      : `Choose a plan from $${lowestMonthlyPrice}/month to continue using Clientific.`;

    return (
      <div className="min-h-screen brand-shell">
        <header className="fixed top-0 left-0 right-0 h-14 z-50 brand-panel border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center space-x-2">
            <ClientificLogo
              className="flex items-center gap-2"
              markClassName="h-7 w-7 text-gray-950 dark:text-white"
              nameClassName="text-lg font-bold text-gray-900 dark:text-gray-100"
              title={APP_NAME}
            />
          </div>
          <Link
            href="/signout"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Sign out
          </Link>
        </header>
        <main className="pt-20 px-4 pb-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                {title}
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
            </div>
            {children}
          </div>
        </main>
        <Toaster richColors position="top-right" />
      </div>
    );
  }

  return (
    <div className="dashboard-shell lg:min-h-screen brand-shell">
      <MobileOverlayChromeWatcher />

      <div className="dashboard-mobile-header lg:hidden shrink-0">
        <DashboardHeader />
      </div>

      <div className="hidden lg:flex fixed top-0 left-0 right-0 h-16 z-50 brand-panel border-b border-gray-200 dark:border-gray-800 items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <ClientificLogo
            className="flex items-center gap-2"
            markClassName="h-8 w-8 text-gray-950 dark:text-white"
            nameClassName="text-xl font-bold text-gray-900 dark:text-gray-100"
            title={APP_NAME}
          />
        </Link>
        <NotificationBell />
      </div>

      <div className="hidden lg:fixed lg:top-16 lg:bottom-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <DashboardNav
          initialBusiness={{
            name: business!.name,
            email: business!.email,
            logoUrl: business!.logoUrl,
            subscriptionPlan: business!.subscriptionPlan,
          }}
        />
      </div>

      <div className="dashboard-scroll lg:pl-64 lg:pt-16">
        {showSubscriptionBanner ? <SubscriptionBanner /> : null}
        <main className="px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-6">
          {children}
        </main>
      </div>

      <div
        className="dashboard-mobile-bottom-nav dashboard-nav-bar lg:hidden fixed bottom-0 left-0 right-0 brand-panel border-t border-gray-200 dark:border-gray-800 z-50"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)' }}
      >
        <MobileBottomNav
          initialBusiness={{
            name: business!.name,
            email: business!.email,
            logoUrl: business!.logoUrl,
            subscriptionPlan: business!.subscriptionPlan,
          }}
        />
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
