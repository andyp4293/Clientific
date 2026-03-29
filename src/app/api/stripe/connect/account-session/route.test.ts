import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn() }));
vi.mock('@/lib/app-url', () => ({ getAppBaseUrlFromRequest: vi.fn(() => 'https://clientific.net') }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/stripe-connect', () => ({
  createConnectAccountSession: vi.fn(),
  ensureBusinessConnectAccount: vi.fn(),
  syncBusinessConnectState: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getSessionBusinessId } from '@/lib/session-business';
import { prisma } from '@/lib/prisma';
import {
  createConnectAccountSession,
  ensureBusinessConnectAccount,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';
import { POST } from './route';

const mockGetSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetBusinessId = getSessionBusinessId as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCreateSession = createConnectAccountSession as ReturnType<typeof vi.fn>;
const mockEnsureConnect = ensureBusinessConnectAccount as ReturnType<typeof vi.fn>;
const mockSyncConnectState = syncBusinessConnectState as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest('http://localhost/api/stripe/connect/account-session', {
    method: 'POST',
  });
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
  mockEnsureConnect.mockResolvedValue({
    id: 'acct_123',
    type: 'none',
    controller: {
      requirement_collection: 'stripe',
    },
  });
  mockCreateSession.mockResolvedValue({ client_secret: 'cas_test_secret' });
  mockSyncConnectState.mockResolvedValue({
    accountId: 'acct_123',
  });
});

describe('POST /api/stripe/connect/account-session', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetBusinessId.mockReturnValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 404 when business is missing', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it('creates an embedded account session for the business', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clientSecret).toBe('cas_test_secret');
    expect(body.accountId).toBe('acct_123');
    expect(mockEnsureConnect).toHaveBeenCalled();
    expect(mockSyncConnectState).toHaveBeenCalledWith('biz-1', 'acct_123');
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'acct_123',
      })
    );
  });

  it('returns a non-retryable platform profile error when Stripe blocks live Custom onboarding', async () => {
    mockCreateSession.mockRejectedValue(
      new Error(
        'Please review the responsibilities of managing losses and collecting requirements for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile.'
      )
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: 'platform_profile_incomplete',
      retryable: false,
    });
  });
});
