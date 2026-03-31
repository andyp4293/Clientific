import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dealRedemption: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { POST } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindRedemption = prisma.dealRedemption.findUnique as ReturnType<typeof vi.fn>;
const mockUpdateRedemption = prisma.dealRedemption.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
});

describe('POST /api/mobile/redeem', () => {
  it('redeems a code and returns the fee summary for the mobile front desk flow', async () => {
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
    mockUpdateRedemption.mockResolvedValue(undefined);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/redeem', {
        method: 'POST',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({
          code: 'AB3DEF7G',
          transactionAmount: 45,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(mockUpdateRedemption).toHaveBeenCalled();
    expect(body).toMatchObject({
      success: true,
      platformFee: 4.5,
      platformFeeLabel: '$4.50',
      customer: {
        name: 'Jordan Lee',
        phoneDisplay: '(555) 123-4567',
      },
      deal: {
        title: 'Spring Special',
        discountLabel: '20% off',
      },
    });
  });
});
