import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { APP_NAME } from '@/lib/brand';
import Link from 'next/link';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasActiveSubscription } from '@/lib/subscription';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { SubscriptionBanner } from '@/components/billing/SubscriptionBanner';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { Toaster } from 'sonner';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signout');
  }

  // Subscription gate — exempt the subscribe page itself to avoid redirect loops
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';
  const isSubscribePage = pathname === '/dashboard/subscribe';

  if (!isSubscribePage && session.user.businessId) {
    const active = await hasActiveSubscription(session.user.businessId);
    if (!active) {
      redirect('/dashboard/subscribe');
    }
  }

  // Locked layout for subscribe page — no nav, no sidebar, just logo + sign out
  if (isSubscribePage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <header className="fixed top-0 left-0 right-0 h-14 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-base">C</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{APP_NAME}</span>
          </div>
          <Link
            href="/signout"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Sign out
          </Link>
        </header>
        <main className="pt-14">
          {children}
        </main>
        <Toaster richColors position="top-right" />
      </div>
    );
  }

  return (
    <div className="dashboard-shell min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile Header */}
      <div className="lg:hidden shrink-0">
        <DashboardHeader />
      </div>

      {/* Desktop Top Bar */}
      <div className="hidden lg:flex fixed top-0 left-0 right-0 h-16 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{APP_NAME}</span>
        </Link>
        <NotificationBell />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:top-16 lg:bottom-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <DashboardNav />
      </div>

      {/* Main Content */}
      <div className="dashboard-scroll lg:pl-64 lg:pt-16">
        <SubscriptionBanner />
        <main className="py-6 px-4 sm:px-6 lg:px-8 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div
        className="dashboard-nav-bar lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg z-50"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2px)' }}
      >
        <MobileBottomNav />
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
