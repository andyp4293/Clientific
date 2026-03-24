'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession, signOut } from 'next-auth/react';
import {
  DASHBOARD_SECTION_ORDER,
  DASHBOARD_SECTION_LABELS,
  getVisibleDashboardNavItems,
  isDashboardRouteActive,
} from '@/lib/navigation';
import { DashboardIcon } from '@/components/layout/nav-icons';

// Nav bar height above safe area (matches iOS tab bar standard)
const NAV_HEIGHT = 52;

type MobileBottomNavBusiness = {
  name: string;
  email: string;
  logoUrl: string | null;
  subscriptionPlan?: string | null;
};

type MobileBottomNavProps = {
  initialBusiness: MobileBottomNavBusiness;
};

export function MobileBottomNav({ initialBusiness }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const { data: session } = useSession();
  const { data } = useQuery({
    queryKey: ['business-info'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business');
      return res.json();
    },
    staleTime: 30_000,
    placeholderData: {
      business: initialBusiness,
    },
  });

  const business = data?.business ?? initialBusiness;
  const businessName = business?.name?.trim() || session?.user?.name || 'User';
  const businessEmail = business?.email?.trim() || session?.user?.email || '';
  const businessInitial = businessName.charAt(0).toUpperCase() || 'U';
  const visibleNavItems = getVisibleDashboardNavItems(business?.subscriptionPlan);
  const primaryNav = visibleNavItems.filter((item) => item.mobilePrimary);
  const moreNav = visibleNavItems.filter((item) => !item.mobilePrimary);

  const isOnMorePage = moreNav.some((item) =>
    isDashboardRouteActive(pathname, item)
  );

  const moreActive = isOnMorePage || showMoreMenu;

  return (
    <>
      {/* More menu backdrop + sheet */}
      {showMoreMenu && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/30" onClick={() => setShowMoreMenu(false)} />
          <div
            className="brand-panel fixed left-0 right-0 z-[60] overflow-y-auto rounded-t-2xl rounded-b-none border-x-0 border-b-0 border-t bg-[rgb(var(--color-gray-50))] shadow-2xl backdrop-blur-2xl dark:bg-[rgb(var(--color-gray-900))]"
            style={{
              bottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom) + 4px)`,
              maxHeight: `calc(100dvh - ${NAV_HEIGHT}px - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 12px)`,
            }}
          >
            {/* Sheet header */}
            <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-gray-100 bg-[rgb(var(--color-gray-50))] px-4 py-3 backdrop-blur-2xl dark:border-gray-800 dark:bg-[rgb(var(--color-gray-900))]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Menu</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Account row */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary">
                {business?.logoUrl ? (
                  <img
                    src={business.logoUrl}
                    alt={`${businessName} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-white">{businessInitial}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{businessName}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{businessEmail}</p>
              </div>
            </div>

            {/* Nav sections */}
            <div className="py-2">
              {DASHBOARD_SECTION_ORDER.map((section) => {
                const pages = moreNav.filter((page) => page.section === section);
                if (pages.length === 0) return null;

                return (
                  <div key={section} className="py-1">
                    <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {DASHBOARD_SECTION_LABELS[section]}
                    </p>
                    {pages.map((page) => {
                      const isActive = isDashboardRouteActive(pathname, page);
                      return (
                        <Link
                          key={page.key}
                          href={page.href}
                          onClick={() => setShowMoreMenu(false)}
                          className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                            isActive
                              ? 'text-primary dark:text-primary-400'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span className={`mr-3 ${isActive ? 'text-primary dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            <DashboardIcon icon={page.icon} className="h-5 w-5" />
                          </span>
                          {page.name}
                          {isActive && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary dark:bg-primary-400" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Sign out */}
            <div className="border-t border-gray-100 p-4 dark:border-gray-800">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Tab bar */}
      <nav
        className="grid grid-cols-5 items-stretch"
        style={{ height: `${NAV_HEIGHT}px` }}
      >
        {primaryNav.map((item) => {
          const isActive = isDashboardRouteActive(pathname, item);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors active:opacity-60 ${
                isActive
                  ? 'text-primary dark:text-primary-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <div
                className={`flex items-center justify-center rounded-full transition-colors ${
                  isActive
                    ? 'bg-primary/10 dark:bg-primary/20'
                    : ''
                }`}
                style={{ width: 40, height: 26 }}
              >
                <DashboardIcon icon={item.icon} className="h-[22px] w-[22px]" />
              </div>
              <span className="text-[10px] font-medium leading-none">
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* More */}
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors active:opacity-60 ${
            moreActive
              ? 'text-primary dark:text-primary-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          <div
            className={`flex items-center justify-center rounded-full transition-colors ${
              moreActive ? 'bg-primary/10 dark:bg-primary/20' : ''
            }`}
            style={{ width: 40, height: 26 }}
          >
            {/* Ellipsis — iOS standard for "More" */}
            <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </div>
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>
    </>
  );
}
