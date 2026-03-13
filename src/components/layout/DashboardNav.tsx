'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  DASHBOARD_DESKTOP_NAV,
  DASHBOARD_SECTION_LABELS,
  DashboardNavSection,
  isDashboardRouteActive,
} from '@/lib/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { DashboardIcon } from '@/components/layout/nav-icons';

const SECTION_ORDER: DashboardNavSection[] = ['core', 'growth', 'operations', 'account'];

export function DashboardNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <div className="brand-panel flex h-full flex-col rounded-none border-y-0 border-l-0 border-r">
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {SECTION_ORDER.map((section) => {
          const items = DASHBOARD_DESKTOP_NAV.filter((item) => item.section === section);
          if (items.length === 0) return null;

          return (
            <div key={section}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                {DASHBOARD_SECTION_LABELS[section]}
              </p>
              <div className="space-y-px">
                {items.map((item) => {
                  const isActive = isDashboardRouteActive(pathname, item);

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary-50 text-gray-900 dark:bg-primary/15 dark:text-white'
                          : 'text-gray-700 hover:bg-primary-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white'
                      }`}
                    >
                      <span
                        className={`mr-3 ${
                          isActive ? 'text-primary dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <DashboardIcon icon={item.icon} className="h-5 w-5" />
                      </span>
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {status !== 'loading' && (
        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 flex items-center">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-semibold text-white">{session?.user?.name?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {session?.user?.name || 'User'}
              </p>
              <p className="truncate text-xs text-gray-600 dark:text-gray-300">{session?.user?.email || ''}</p>
            </div>
          </div>
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-primary-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
