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
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/customer-filters', () => ({
  buildCustomerWhereClause: vi.fn(() => ({ businessId: 'biz-1' })),
}));
vi.mock('@/lib/phone', () => ({
  formatPhoneForDisplay: vi.fn((value: string | null | undefined) => value ?? null),
}));

import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCountCustomers = prisma.customer.count as ReturnType<typeof vi.fn>;
const mockFindCustomers = prisma.customer.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
  mockFindBusiness.mockResolvedValue({
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'ABC Nails',
    businessType: 'Salon',
    phone: '+15551234567',
    street: '1 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    country: 'United States',
  });
  mockCountCustomers.mockResolvedValue(2);
  mockFindCustomers.mockResolvedValue([
    {
      id: 'cust-1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '+15551234567',
      createdAt: new Date('2026-03-18T14:00:00.000Z'),
      lastVisit: new Date('2026-03-28T14:00:00.000Z'),
      totalSpent: 120,
      smsConsent: true,
      smsOptedOut: false,
      dealSmsBlocked: false,
      _count: {
        checkIns: 3,
        appointments: 2,
      },
      groupMemberships: [
        {
          group: {
            id: 'group-1',
            name: 'VIP',
            promotionSmsEnabled: true,
          },
        },
      ],
    },
  ]);
});

describe('mobile customers route', () => {
  it('returns paginated customer records for the native app', async () => {
    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/customers?page=1&pageSize=20&search=jordan', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.totalCustomers).toBe(2);
    expect(body.totalPages).toBe(1);
    expect(body.search).toBe('jordan');
    expect(body.customers[0]).toEqual(
      expect.objectContaining({
        name: 'Jordan Lee',
        totalSpentLabel: '$120.00',
        visitsCount: 3,
      }),
    );
  });
});
