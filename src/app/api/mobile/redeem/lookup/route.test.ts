import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dealRedemption: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindRedemption = prisma.dealRedemption.findUnique as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
});

describe('GET /api/mobile/redeem/lookup', () => {
  it('returns the deal preview for a valid redemption code', async () => {
    mockFindRedemption.mockResolvedValue({
      code: 'AB3DEF7G',
      usedAt: null,
      deal: {
        businessId: 'biz-1',
        title: 'Spring Special',
        discountType: 'percent_off',
        discountValue: 20,
        platformFeePercent: 10,
      },
      customer: {
        name: 'Jordan Lee',
        phone: '+15551234567',
      },
    });

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/redeem/lookup?code=AB3DEF7G', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      alreadyUsed: false,
      customer: {
        name: 'Jordan Lee',
        phoneDisplay: '(555) 123-4567',
      },
      deal: {
        title: 'Spring Special',
        discountLabel: '20% off',
        platformFeePercent: 10,
      },
    });
  });
});
