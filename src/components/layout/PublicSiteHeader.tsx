'use client';

import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

type PublicNavKey = 'home' | 'explore' | 'pricing' | 'partner' | 'business' | 'deal' | 'book';

interface PublicSiteHeaderProps {
  active?: PublicNavKey;
  ctaLabel?: string;
  ctaHref?: string;
  showLogin?: boolean;
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  activeKeys: PublicNavKey[];
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'For Businesses', href: '/', activeKeys: ['home'] },
  { key: 'explore', label: 'For Customers', href: '/explore', activeKeys: ['explore', 'business', 'deal', 'book'] },
  { key: 'pricing', label: 'Pricing', href: '/pricing', activeKeys: ['pricing'] },
  { key: 'partner', label: 'Refer & Earn', href: '/partner', activeKeys: ['partner'] },
];

export function PublicSiteHeader({
  active = 'home',
  ctaLabel = 'Start Free Trial',
  ctaHref = '/register',
  showLogin = true,
}: PublicSiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/80 backdrop-blur-md dark:border-gray-900 dark:bg-gray-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-sm">
            C
          </span>
          <span className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">{APP_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = item.activeKeys.includes(active);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {showLogin && (
            <Link
              href="/login"
              className="hidden rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900 sm:inline-flex"
            >
              Log In
            </Link>
          )}
          <Link
            href={ctaHref}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
