'use client';

import Link from 'next/link';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { APP_NAME } from '@/lib/brand';
import { ClientificLogo } from '@/components/brand/ClientificLogo';

export function DashboardHeader() {
  return (
    <header className="brand-panel border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-4">
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
    </header>
  );
}
