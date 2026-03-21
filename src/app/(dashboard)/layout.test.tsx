// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockGetServerSession = vi.fn();
const mockHeaders = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const mockFindUnique = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('next/headers', () => ({
  headers: async () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('@/components/layout/DashboardNav', () => ({
  DashboardNav: () => <div data-testid="dashboard-nav">Dashboard nav</div>,
}));

vi.mock('@/components/layout/DashboardHeader', () => ({
  DashboardHeader: () => <div data-testid="dashboard-header">Dashboard header</div>,
}));

vi.mock('@/components/layout/MobileBottomNav', () => ({
  MobileBottomNav: () => <div data-testid="mobile-bottom-nav">Mobile bottom nav</div>,
}));

vi.mock('@/components/layout/MobileOverlayChromeWatcher', () => ({
  MobileOverlayChromeWatcher: () => <div data-testid="mobile-overlay-watcher">Overlay watcher</div>,
}));

vi.mock('@/components/billing/SubscriptionBanner', () => ({
  SubscriptionBanner: () => <div data-testid="subscription-banner">Subscription banner</div>,
}));

vi.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notifications</div>,
}));

vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

import DashboardLayout from './layout';

const activeTrialBusiness = {
  subscriptionStatus: 'trialing',
  trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  phone: '',
  street: null,
  city: null,
  state: null,
  zipCode: null,
  country: null,
};

describe('Dashboard layout onboarding gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'biz-1',
        businessId: 'biz-1',
      },
    });
  });

  it('redirects incomplete businesses back to onboarding for dashboard routes', async () => {
    mockHeaders.mockReturnValue({
      get: () => '/dashboard/customers',
    });
    mockFindUnique.mockResolvedValue(activeTrialBusiness);

    await expect(
      DashboardLayout({ children: <div>Customers</div> })
    ).rejects.toThrow('REDIRECT:/dashboard/onboarding');

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/onboarding');
  });

  it('renders a locked onboarding shell without dashboard navigation while setup is incomplete', async () => {
    mockHeaders.mockReturnValue({
      get: () => '/dashboard/onboarding',
    });
    mockFindUnique.mockResolvedValue(activeTrialBusiness);

    render(await DashboardLayout({ children: <div>Onboarding content</div> }));

    expect(screen.getByText(/finish setup/i)).toBeInTheDocument();
    expect(
      screen.getByText(/before the dashboard unlocks/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Onboarding content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-nav')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
  });

  it('redirects completed businesses away from onboarding back to the dashboard', async () => {
    mockHeaders.mockReturnValue({
      get: () => '/dashboard/onboarding',
    });
    mockFindUnique.mockResolvedValue({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      phone: '(555) 123-4567',
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      country: 'United States',
    });

    await expect(
      DashboardLayout({ children: <div>Onboarding content</div> })
    ).rejects.toThrow('REDIRECT:/dashboard');

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('renders a retryable unavailable state when the business query cannot reach the database', async () => {
    mockHeaders.mockReturnValue({
      get: () => '/dashboard/payouts',
    });
    mockFindUnique.mockRejectedValue(
      new Error('Can\'t reach database server at `example.neon.tech:5432`')
    );

    render(await DashboardLayout({ children: <div>Payouts content</div> }));

    expect(screen.getByText(/dashboard temporarily unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/couldn\'t reach your business data just now/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute(
      'href',
      '/dashboard/payouts'
    );
    expect(screen.queryByText('Payouts content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-nav')).not.toBeInTheDocument();
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it('retries a transient database failure once before rendering the dashboard gate', async () => {
    mockHeaders.mockReturnValue({
      get: () => '/dashboard/subscribe',
    });
    mockFindUnique
      .mockRejectedValueOnce(new Error('temporary connection reset'))
      .mockResolvedValueOnce({
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        phone: '(555) 123-4567',
        street: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        country: 'United States',
      });

    render(await DashboardLayout({ children: <div>Subscribe content</div> }));

    expect(screen.getByText('Subscribe content')).toBeInTheDocument();
    expect(screen.queryByText(/dashboard temporarily unavailable/i)).not.toBeInTheDocument();
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it('keeps the subscribe shell available when business lookup stays down', async () => {
    mockHeaders.mockReturnValue({
      get: () => '/dashboard/subscribe',
    });
    mockFindUnique.mockRejectedValue(new Error('Can\'t reach database server'));

    render(await DashboardLayout({ children: <div>Subscribe content</div> }));

    expect(screen.getByText('Subscribe content')).toBeInTheDocument();
    expect(screen.queryByText(/dashboard temporarily unavailable/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-nav')).not.toBeInTheDocument();
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it('keeps payouts accessible even when the subscription is no longer active', async () => {
    mockHeaders.mockReturnValue({
      get: () => '/dashboard/payouts',
    });
    mockFindUnique.mockResolvedValue({
      subscriptionStatus: 'canceled',
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      phone: '(555) 123-4567',
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      country: 'United States',
    });

    render(await DashboardLayout({ children: <div>Payouts content</div> }));

    expect(screen.getByText('Payouts content')).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalledWith('/dashboard/subscribe');
  });
});
