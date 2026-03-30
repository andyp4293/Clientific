import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock('@/lib/referral', () => ({
  generateReferralCode: vi.fn(),
}));
vi.mock('@/lib/referral-sharing', () => ({
  getReferralSharingStatus: vi.fn(),
  resolveReferralSharingStatus: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { generateReferralCode } from '@/lib/referral';
import {
  getReferralSharingStatus,
  resolveReferralSharingStatus,
} from '@/lib/referral-sharing';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockUpdateBusiness = prisma.business.update as ReturnType<typeof vi.fn>;
const mockGenerateReferralCode = generateReferralCode as ReturnType<typeof vi.fn>;
const mockGetReferralSharingStatus = getReferralSharingStatus as ReturnType<typeof vi.fn>;
const mockResolveReferralSharingStatus = resolveReferralSharingStatus as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
  mockFindBusiness.mockResolvedValue({
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    phone: '+15551234567',
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'US',
    referralCode: 'ABCD1234',
    stripeConnectAccountId: 'acct_1',
    stripeConnectChargesEnabled: true,
    stripeConnectPayoutsEnabled: true,
    stripeConnectDetailsSubmitted: true,
    referralsMade: [
      {
        id: 'ref-1',
        createdAt: new Date('2026-03-29T12:00:00.000Z'),
        status: 'credited',
        commissions: [{ amountDollars: 87 }],
        referee: { name: 'North Studio' },
      },
    ],
  });
  mockGetReferralSharingStatus.mockReturnValue({
    ready: true,
    code: 'ready',
    message: 'Referral link sharing is ready.',
  });
  mockResolveReferralSharingStatus.mockResolvedValue({
    ready: true,
    code: 'ready',
    message: 'Referral link sharing is ready.',
  });
  mockGenerateReferralCode.mockResolvedValue('NEWCODE1');
  mockUpdateBusiness.mockResolvedValue({});
});

describe('GET /api/mobile/referrals', () => {
  it('returns referral stats and activity for a valid mobile session', async () => {
    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/referrals', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.business.name).toBe('Clientific Studio');
    expect(body.referralCode).toBe('ABCD1234');
    expect(body.totalCredits).toBe(87);
    expect(body.activeCount).toBe(1);
    expect(body.referrals[0]).toEqual(
      expect.objectContaining({
        refereeName: 'North Studio',
        statusLabel: 'Paying',
        creditAmountLabel: '$87.00',
      }),
    );
  });

  it('returns 401 when the bearer token is missing', async () => {
    mockGetBearerToken.mockReturnValue(null);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/referrals'),
    );

    expect(response.status).toBe(401);
  });
});
