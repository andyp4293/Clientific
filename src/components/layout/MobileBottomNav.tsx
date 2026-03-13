'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  DASHBOARD_MOBILE_MORE_NAV,
  DASHBOARD_MOBILE_PRIMARY_NAV,
  DASHBOARD_SECTION_LABELS,
  DashboardNavSection,
  isDashboardRouteActive,
} from '@/lib/navigation';
import { DashboardIcon } from '@/components/layout/nav-icons';

const SECTION_ORDER: DashboardNavSection[] = ['core', 'growth', 'operations', 'account'];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const { data: session } = useSession();

  const isOnMorePage = DASHBOARD_MOBILE_MORE_NAV.some((item) =>
    isDashboardRouteActive(pathname, item)
  );

  return (
    <>
      {showMoreMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowMoreMenu(false)} />
          <div
            className="brand-panel fixed left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl rounded-b-none border-x-0 border-b-0 border-t shadow-2xl backdrop-blur-2xl"
            style={{ bottom: 'calc(3rem + env(safe-area-inset-bottom) + 2px)' }}
          >
            <div className="brand-panel sticky top-0 flex items-center justify-between rounded-t-2xl rounded-b-none border-x-0 border-t-0 border-b px-4 py-3 backdrop-blur-2xl">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Menu</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5 text-gray-600 dark:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-medium text-white">{session?.user?.name?.charAt(0).toUpperCase() || 'U'}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{session?.user?.name || 'User'}</p>
                <p className="truncate text-xs text-gray-600 dark:text-gray-300">{session?.user?.email || ''}</p>
              </div>
            </div>

            <div className="py-2">
              {SECTION_ORDER.map((section) => {
                const pages = DASHBOARD_MOBILE_MORE_NAV.filter((page) => page.section === section);
                if (pages.length === 0) return null;

                return (
                  <div key={section} className="py-1">
                    <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
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
                              ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                              : 'text-gray-700 hover:bg-primary-50 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white'
                          }`}
                        >
                          <span className={`mr-3 ${isActive ? 'text-primary dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'}`}>
                            <DashboardIcon icon={page.icon} className="h-5 w-5" />
                          </span>
                          {page.name}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 p-4 dark:border-gray-700">
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

      <nav className="flex h-12 items-start justify-around px-2">
        {DASHBOARD_MOBILE_PRIMARY_NAV.map((item) => {
          const isActive = isDashboardRouteActive(pathname, item);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-start px-1 pt-2 transition-colors ${
                isActive
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white'
              }`}
            >
              <div className={`mb-1 ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                <DashboardIcon icon={item.icon} className="h-6 w-6" />
              </div>
              <span
                className={`w-full truncate text-center text-[10px] font-medium ${
                  isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}

        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className={`flex min-w-0 flex-1 flex-col items-center justify-start px-1 pt-2 transition-colors ${
            isOnMorePage || showMoreMenu
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white'
          }`}
        >
          <div
            className={`mb-1 ${
              isOnMorePage || showMoreMenu ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
            }`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <span
            className={`w-full truncate text-center text-[10px] font-medium ${
              isOnMorePage || showMoreMenu
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-200'
            }`}
          >
            More
          </span>
        </button>
      </nav>
    </>
  );
}
