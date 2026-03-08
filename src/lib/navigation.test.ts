import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_MOBILE_MORE_NAV,
  DASHBOARD_MOBILE_PRIMARY_NAV,
  DASHBOARD_NAV_ITEMS,
  DashboardNavItem,
  getActiveDashboardRoute,
  isDashboardRouteActive,
  normalizePathname,
} from '@/lib/navigation';

const exactItems = DASHBOARD_NAV_ITEMS.filter((item) => item.exact);
const nonExactItems = DASHBOARD_NAV_ITEMS.filter((item) => !item.exact);

describe('normalizePathname', () => {
  it.each([
    ['', '/'],
    ['/', '/'],
    ['dashboard', '/dashboard'],
    ['/dashboard', '/dashboard'],
    ['/dashboard/', '/dashboard'],
    ['/dashboard///', '/dashboard'],
    ['///dashboard///', '/'],
    ['/dashboard/appointments/', '/dashboard/appointments'],
    ['/dashboard/appointments?x=1', '/dashboard/appointments'],
    ['/dashboard/appointments#section', '/dashboard/appointments'],
    ['https://clientific.app/dashboard', '/dashboard'],
    ['https://clientific.app/dashboard/', '/dashboard'],
    ['https://clientific.app/dashboard/appointments?tab=today', '/dashboard/appointments'],
    ['http://localhost:3000/dashboard/customers', '/dashboard/customers'],
    ['http://localhost:3000/dashboard/customers/', '/dashboard/customers'],
    ['http://localhost:3000/dashboard/customers?search=jane', '/dashboard/customers'],
    ['http://localhost:3000/dashboard/settings#billing', '/dashboard/settings'],
    ['dashboard/settings', '/dashboard/settings'],
    ['dashboard/settings/', '/dashboard/settings'],
    ['dashboard/settings/billing', '/dashboard/settings/billing'],
    ['dashboard/settings/billing/', '/dashboard/settings/billing'],
    ['/dashboard/settings/billing//', '/dashboard/settings/billing'],
    ['https://example.com/dashboard/settings/billing/', '/dashboard/settings/billing'],
    ['/explore', '/explore'],
    ['/explore/', '/explore'],
    ['explore', '/explore'],
    ['https://clientific.app/explore?location=miami', '/explore'],
    ['/book/my-salon', '/book/my-salon'],
    ['/book/my-salon/', '/book/my-salon'],
    ['http://localhost:3000/book/my-salon?service=1', '/book/my-salon'],
    ['http://localhost:3000/', '/'],
    ['/?a=1', '/'],
    ['/###', '/'],
  ])('normalizes "%s" to "%s"', (input, expected) => {
    expect(normalizePathname(input)).toBe(expected);
  });
});

describe('isDashboardRouteActive', () => {
  it.each(DASHBOARD_NAV_ITEMS)('matches exact href for %s', (item) => {
    expect(isDashboardRouteActive(item.href, item)).toBe(true);
  });

  it.each(DASHBOARD_NAV_ITEMS)('matches trailing slash href for %s', (item) => {
    expect(isDashboardRouteActive(`${item.href}/`, item)).toBe(true);
  });

  it.each(nonExactItems)('matches nested path for non-exact item %s', (item) => {
    expect(isDashboardRouteActive(`${item.href}/nested`, item)).toBe(true);
  });

  it.each(exactItems)('does not match nested path for exact item %s', (item) => {
    expect(isDashboardRouteActive(`${item.href}/nested`, item)).toBe(false);
  });

  it.each([
    ['/dashboard/appointments', '/dashboard/customers'],
    ['/dashboard/customers', '/dashboard/appointments'],
    ['/dashboard/services', '/dashboard/campaigns'],
    ['/dashboard/rewards', '/dashboard/reviews'],
    ['/dashboard/reviews', '/dashboard/rewards'],
    ['/dashboard/checkins', '/dashboard/redeem'],
    ['/dashboard/redeem', '/dashboard/checkins'],
    ['/dashboard/business-hours', '/dashboard/settings'],
    ['/dashboard/settings', '/dashboard/settings/billing'],
    ['/dashboard/settings/billing', '/dashboard/settings'],
    ['/dashboard/referrals', '/dashboard/campaigns'],
    ['/dashboard/campaigns', '/dashboard/referrals'],
    ['/dashboard/analytics', '/dashboard/services'],
    ['/dashboard/services', '/dashboard/analytics'],
    ['/dashboard', '/dashboard/appointments'],
    ['/dashboard/appointments', '/dashboard'],
    ['/explore', '/dashboard/appointments'],
    ['/pricing', '/dashboard/settings'],
    ['/book/my-salon', '/dashboard/customers'],
  ])('does not match unrelated routes (%s vs %s)', (pathname, href) => {
    const item = DASHBOARD_NAV_ITEMS.find((navItem) => navItem.href === href) as DashboardNavItem;
    expect(isDashboardRouteActive(pathname, item)).toBe(false);
  });
});

describe('getActiveDashboardRoute', () => {
  it.each([
    ['/dashboard', 'dashboard'],
    ['/dashboard/', 'dashboard'],
    ['/dashboard/appointments', 'appointments'],
    ['/dashboard/appointments/new', 'appointments'],
    ['/dashboard/customers', 'customers'],
    ['/dashboard/customers/abc', 'customers'],
    ['/dashboard/campaigns', 'campaigns'],
    ['/dashboard/campaigns/new', 'campaigns'],
    ['/dashboard/services', 'services'],
    ['/dashboard/services/edit', 'services'],
    ['/dashboard/checkins', 'checkins'],
    ['/dashboard/checkins/history', 'checkins'],
    ['/dashboard/redeem', 'redeem'],
    ['/dashboard/redeem/manual', null],
    ['/dashboard/business-hours', 'business-hours'],
    ['/dashboard/business-hours/edit', 'business-hours'],
    ['/dashboard/reviews', 'reviews'],
    ['/dashboard/reviews/respond', 'reviews'],
    ['/dashboard/analytics', 'analytics'],
    ['/dashboard/analytics/custom', 'analytics'],
    ['/dashboard/rewards', 'rewards'],
    ['/dashboard/rewards/new', 'rewards'],
    ['/dashboard/referrals', 'referrals'],
    ['/dashboard/referrals/campaign', null],
    ['/dashboard/settings', 'settings'],
    ['/dashboard/settings/profile', null],
    ['/dashboard/settings/billing', 'billing'],
    ['/dashboard/settings/billing/history', null],
    ['/pricing', null],
    ['/explore', null],
    ['/book/my-salon', null],
  ])('returns expected route key for %s', (pathname, expectedKey) => {
    const active = getActiveDashboardRoute(pathname);
    expect(active?.key ?? null).toBe(expectedKey);
  });

  it('prefers the most specific route when prefixes overlap', () => {
    const active = getActiveDashboardRoute('/dashboard/settings/billing');
    expect(active?.key).toBe('billing');
  });

  it('returns null for an empty pathname', () => {
    expect(getActiveDashboardRoute('')).toBeNull();
  });
});

describe('navigation config integrity', () => {
  it('has unique keys', () => {
    const keys = DASHBOARD_NAV_ITEMS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has unique href values', () => {
    const hrefs = DASHBOARD_NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('keeps primary mobile nav to four items', () => {
    expect(DASHBOARD_MOBILE_PRIMARY_NAV).toHaveLength(4);
  });

  it('assigns all non-primary items to the more menu', () => {
    const primaryKeys = new Set(DASHBOARD_MOBILE_PRIMARY_NAV.map((item) => item.key));
    expect(
      DASHBOARD_MOBILE_MORE_NAV.every((item) => !primaryKeys.has(item.key))
    ).toBe(true);
  });

  it('covers all items across primary + more collections', () => {
    const allKeys = [
      ...DASHBOARD_MOBILE_PRIMARY_NAV.map((item) => item.key),
      ...DASHBOARD_MOBILE_MORE_NAV.map((item) => item.key),
    ];
    expect(new Set(allKeys).size).toBe(DASHBOARD_NAV_ITEMS.length);
  });
});
