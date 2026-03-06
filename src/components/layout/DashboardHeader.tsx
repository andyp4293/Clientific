'use client';

import Link from 'next/link';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { APP_NAME } from '@/lib/brand';

export function DashboardHeader() {
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-4">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{APP_NAME}</span>
        </Link>
        <NotificationBell />
      </div>
    </header>
  );
}
