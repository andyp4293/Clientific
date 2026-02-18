import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { SubscriptionBanner } from '@/components/billing/SubscriptionBanner';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signout');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <DashboardHeader />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <DashboardNav />
      </div>      {/* Main Content */}
      <div className="lg:pl-64">
        <SubscriptionBanner />
        <main className="py-6 px-4 sm:px-6 lg:px-8 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <MobileBottomNav />
      </div>
    </div>
  );
}
