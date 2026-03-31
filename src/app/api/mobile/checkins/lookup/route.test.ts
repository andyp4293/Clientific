import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/phone', () => ({
  buildCustomerPhoneMatchClauses: vi.fn(() => [{ phone: '+15551234567' }]),
  formatPhoneForDisplay: vi.fn((value: string | null | undefined) => value ?? null),
  normalizeOptionalStoredPhoneNumber: vi.fn((value: string | null) => value),
}));

import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindCustomers = prisma.customer.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
  mockFindBusiness.mockResolvedValue({
    timezone: 'America/New_York',
  });
});

describe('mobile checkin lookup route', () => {
  it('returns an existing customer match', async () => {
    mockFindCustomers.mockResolvedValue([
      {
        id: 'cust-1',
        name: 'Jordan Lee',
        phone: '+15551234567',
        email: 'jordan@example.com',
        lastVisit: new Date('2026-03-20T14:00:00.000Z'),
      },
    ]);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/checkins/lookup?phone=5551234567', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe('existing');
    expect(body.customer.name).toBe('Jordan Lee');
  });
});
