import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    customer: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    customerGroup: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
  checkPlanLimit: vi.fn().mockResolvedValue({
    allowed: true,
    current: 1,
    limit: 100,
  }),
}));
vi.mock('@/lib/twilio-keyword-sync', () => ({
  startRecentTwilioKeywordSync: vi.fn(),
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { startRecentTwilioKeywordSync } from '@/lib/twilio-keyword-sync';
import { GET, POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCountCustomers = prisma.customer.count as ReturnType<typeof vi.fn>;
const mockFindCustomers = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockCreateCustomer = prisma.customer.create as ReturnType<typeof vi.fn>;
const mockFindCustomer = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockFindGroups = prisma.customerGroup.findMany as ReturnType<typeof vi.fn>;
const mockStartRecentTwilioKeywordSync =
  startRecentTwilioKeywordSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
  mockStartRecentTwilioKeywordSync.mockImplementation(() => undefined);
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
});

describe('GET /api/mobile/customers', () => {
  it('returns paginated customer records plus groups and active filters', async () => {
    mockCountCustomers.mockResolvedValue(2);
    mockFindGroups.mockResolvedValue([
      {
        id: 'group-1',
        name: 'VIP',
        promotionSmsEnabled: true,
        _count: { memberships: 4 },
      },
    ]);
    mockFindCustomers.mockResolvedValue([
      {
        id: 'cust-1',
        name: 'Jordan Lee',
        email: 'jordan@example.com',
        phone: '+15551234567',
        createdAt: new Date('2026-03-18T14:00:00.000Z'),
        lastVisit: new Date('2026-03-28T14:00:00.000Z'),
        totalSpent: 120,
        segment: 'VIP',
        smsConsent: true,
        smsMarketingConsent: true,
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

    const response = await GET(
      new Request(
        'https://www.clientific.app/api/mobile/customers?page=1&pageSize=20&search=jordan&sms=enabled',
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(mockStartRecentTwilioKeywordSync).toHaveBeenCalledTimes(1);
    expect(body.totalCustomers).toBe(2);
    expect(body.filters.sms).toBe('enabled');
    expect(body.groups[0]).toMatchObject({
      id: 'group-1',
      name: 'VIP',
      membersCount: 4,
    });
    expect(body.customers[0]).toMatchObject({
      name: 'Jordan Lee',
      totalSpentLabel: '$120.00',
      segmentLabel: 'VIP',
      smsMarketingConsent: true,
      visitsCount: 3,
    });
  });

  it('still returns customers when the background sync starter throws', async () => {
    mockStartRecentTwilioKeywordSync.mockImplementation(() => {
      throw new Error('twilio slow');
    });
    mockCountCustomers.mockResolvedValue(0);
    mockFindGroups.mockResolvedValue([]);
    mockFindCustomers.mockResolvedValue([]);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/customers?page=1&pageSize=20'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totalCustomers: 0,
      customers: [],
    });
  });
});

describe('POST /api/mobile/customers', () => {
  it('creates a mobile customer record and returns the formatted customer', async () => {
    mockFindCustomer.mockResolvedValue(null);
    mockCreateCustomer.mockResolvedValue({
      id: 'cust-1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '+15551234567',
      createdAt: new Date('2026-03-18T14:00:00.000Z'),
      lastVisit: null,
      totalSpent: 0,
      segment: 'NEW',
      smsConsent: false,
      smsMarketingConsent: false,
      smsOptedOut: false,
      dealSmsBlocked: false,
      _count: {
        checkIns: 0,
      },
      groupMemberships: [],
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/customers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Jordan Lee',
          email: 'jordan@example.com',
          phone: '(555) 123-4567',
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body.customer).toMatchObject({
      name: 'Jordan Lee',
      segmentLabel: 'New',
      smsMarketingConsent: false,
      visitsCount: 0,
    });
    expect(mockCreateCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          name: 'Jordan Lee',
        }),
      }),
    );
  });
});
