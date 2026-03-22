import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn() }));
vi.mock('@/lib/app-url', () => ({ getAppBaseUrlFromRequest: vi.fn(() => 'https://clientific.app') }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/stripe-connect', () => ({
  createConnectOnboardingLink: vi.fn(),
  ensureBusinessConnectAccount: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getSessionBusinessId } from '@/lib/session-business';
import { prisma } from '@/lib/prisma';
import {
  createConnectOnboardingLink,
  ensureBusinessConnectAccount,
} from '@/lib/stripe-connect';
import { GET } from './route';

const mockGetSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetBusinessId = getSessionBusinessId as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCreateLink = createConnectOnboardingLink as ReturnType<typeof vi.fn>;
const mockEnsureConnect = ensureBusinessConnectAccount as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest('http://localhost/api/stripe/connect/onboarding-link/refresh');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({});
  mockGetBusinessId.mockReturnValue('biz-1');
  mockFindUnique.mockResolvedValue({
    id: 'biz-1',
    email: 'owner@example.com',
    name: 'Test Salon',
    phone: '(555) 111-2222',
    businessEmail: 'hello@testsalon.com',
    publicId: 'CF-66W551',
    slug: 'test-salon',
    stripeConnectAccountId: 'acct_123',
  });
  mockEnsureConnect.mockResolvedValue({ id: 'acct_123' });
  mockCreateLink.mockResolvedValue({ url: 'https://connect.stripe.test/onboarding/acct_123' });
});

describe('GET /api/stripe/connect/onboarding-link/refresh', () => {
  it('redirects to login when unauthenticated', async () => {
    mockGetBusinessId.mockReturnValue(null);

    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://clientific.app/login?callbackUrl=%2Fdashboard%2Fpayouts'
    );
  });

  it('redirects to a fresh hosted onboarding link', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://connect.stripe.test/onboarding/acct_123');
    expect(mockCreateLink).toHaveBeenCalledWith({
      accountId: 'acct_123',
      refreshUrl: 'https://clientific.app/api/stripe/connect/onboarding-link/refresh',
      returnUrl: 'https://clientific.app/dashboard/payouts?stripe_onboarding=return',
    });
  });

  it('redirects back to setup when link recreation fails', async () => {
    mockCreateLink.mockRejectedValue(new Error('Stripe unavailable'));

    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://clientific.app/dashboard/payouts?stripe_onboarding=refresh_error'
    );
  });
});
