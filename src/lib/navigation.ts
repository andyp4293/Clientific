export type DashboardNavSection = 'core' | 'growth' | 'operations' | 'account';

export type DashboardNavIcon =
  | 'home'
  | 'calendar'
  | 'users'
  | 'briefcase'
  | 'tag'
  | 'check'
  | 'scan'
  | 'star'
  | 'chart'
  | 'gift'
  | 'clock'
  | 'megaphone'
  | 'creditcard'
  | 'banknotes'
  | 'settings';

export interface DashboardNavItem {
  key: string;
  name: string;
  href: `/dashboard${string}` | '/dashboard';
  icon: DashboardNavIcon;
  section: DashboardNavSection;
  exact?: boolean;
  mobilePrimary?: boolean;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    href: '/dashboard',
    icon: 'home',
    section: 'core',
    exact: true,
    mobilePrimary: true,
  },
  {
    key: 'appointments',
    name: 'Appointments',
    href: '/dashboard/appointments',
    icon: 'calendar',
    section: 'core',
    mobilePrimary: true,
  },
  {
    key: 'customers',
    name: 'Customers',
    href: '/dashboard/customers',
    icon: 'users',
    section: 'core',
    mobilePrimary: true,
  },
  {
    key: 'campaigns',
    name: 'Deals',
    href: '/dashboard/campaigns',
    icon: 'tag',
    section: 'growth',
    mobilePrimary: true,
  },
  {
    key: 'services',
    name: 'Services & Staff',
    href: '/dashboard/services',
    icon: 'briefcase',
    section: 'operations',
  },
  {
    key: 'checkins',
    name: 'Check-Ins',
    href: '/dashboard/checkins',
    icon: 'check',
    section: 'operations',
  },
  {
    key: 'redeem',
    name: 'Redeem',
    href: '/dashboard/redeem',
    icon: 'scan',
    section: 'operations',
    exact: true,
  },
  {
    key: 'business-hours',
    name: 'Business Hours',
    href: '/dashboard/business-hours',
    icon: 'clock',
    section: 'operations',
  },
  {
    key: 'reviews',
    name: 'Reviews',
    href: '/dashboard/reviews',
    icon: 'star',
    section: 'growth',
  },
  {
    key: 'analytics',
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: 'chart',
    section: 'growth',
  },
  {
    key: 'rewards',
    name: 'Rewards',
    href: '/dashboard/rewards',
    icon: 'gift',
    section: 'growth',
  },
  {
    key: 'referrals',
    name: 'Refer & Earn',
    href: '/dashboard/referrals',
    icon: 'megaphone',
    section: 'growth',
    exact: true,
  },
  {
    key: 'payouts',
    name: 'Payouts',
    href: '/dashboard/payouts',
    icon: 'banknotes',
    section: 'growth',
  },
  {
    key: 'billing',
    name: 'Billing',
    href: '/dashboard/settings/billing',
    icon: 'creditcard',
    section: 'account',
    exact: true,
  },
  {
    key: 'settings',
    name: 'Settings',
    href: '/dashboard/settings',
    icon: 'settings',
    section: 'account',
    exact: true,
  },
];

export const DASHBOARD_DESKTOP_NAV = DASHBOARD_NAV_ITEMS;

export const DASHBOARD_MOBILE_PRIMARY_NAV = DASHBOARD_NAV_ITEMS.filter(
  (item) => item.mobilePrimary
);

export const DASHBOARD_MOBILE_MORE_NAV = DASHBOARD_NAV_ITEMS.filter(
  (item) => !item.mobilePrimary
);

export const DASHBOARD_SECTION_ORDER: DashboardNavSection[] = [
  'core',
  'operations',
  'growth',
  'account',
];

export function normalizePathname(pathname: string): string {
  if (!pathname) return '/';

  try {
    const parsed = pathname.startsWith('http')
      ? new URL(pathname)
      : new URL(pathname, 'https://clientific.app');
    pathname = parsed.pathname;
  } catch {
    // keep raw pathname fallback
  }

  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }

  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

export function isDashboardRouteActive(
  pathname: string,
  item: Pick<DashboardNavItem, 'href' | 'exact'>
): boolean {
  const current = normalizePathname(pathname);
  const target = normalizePathname(item.href);

  if (item.exact) {
    return current === target;
  }

  return current === target || current.startsWith(`${target}/`);
}

export function getActiveDashboardRoute(pathname: string): DashboardNavItem | null {
  const sorted = [...DASHBOARD_NAV_ITEMS].sort((a, b) => b.href.length - a.href.length);
  return sorted.find((item) => isDashboardRouteActive(pathname, item)) ?? null;
}

export const DASHBOARD_SECTION_LABELS: Record<DashboardNavSection, string> = {
  core: 'Core',
  growth: 'Growth',
  operations: 'Operations',
  account: 'Account',
};
