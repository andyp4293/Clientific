import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { startRecentTwilioKeywordSync } from '@/lib/twilio-keyword-sync';
import { GET, POST } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockFindCustomers = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockFindCustomer = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockCreateCustomer = prisma.customer.create as ReturnType<typeof vi.fn>;
const mockFindGroups = prisma.customerGroup.findMany as ReturnType<typeof vi.fn>;
const mockStartRecentTwilioKeywordSync =
  startRecentTwilioKeywordSync as ReturnType<typeof vi.fn>;

describe('GET /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: {
        businessId: 'biz-1',
      },
    });
    mockStartRecentTwilioKeywordSync.mockImplementation(() => undefined);
    mockFindCustomers.mockResolvedValue([]);
    mockFindCustomer.mockResolvedValue(null);
    mockFindGroups.mockResolvedValue([]);
  });

  it('starts background keyword sync before returning customers', async () => {
    const response = await GET(new Request('https://www.clientific.app/api/customers'));

    expect(response.status).toBe(200);
    expect(mockStartRecentTwilioKeywordSync).toHaveBeenCalledTimes(1);
    expect(mockFindCustomers).toHaveBeenCalledTimes(1);
  });

  it('still returns customers when the background sync starter throws', async () => {
    mockStartRecentTwilioKeywordSync.mockImplementation(() => {
      throw new Error('twilio slow');
    });

    const response = await GET(new Request('https://www.clientific.app/api/customers'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      customers: [],
    });
    expect(mockFindCustomers).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: {
        businessId: 'biz-1',
      },
    });
    mockFindCustomer.mockResolvedValue(null);
    mockFindGroups.mockResolvedValue([]);
  });

  it('creates manually added phone customers with SMS and marketing enabled', async () => {
    mockCreateCustomer.mockResolvedValue({
      id: 'cust-1',
      name: 'Andy Pham',
      email: 'andyphamjr@yahoo.com',
      phone: '8482612613',
      smsConsent: true,
      smsMarketingConsent: true,
      smsOptedOut: false,
      dealSmsBlocked: false,
      groupMemberships: [],
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/customers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Andy Pham',
          email: 'andyphamjr@yahoo.com',
          phone: '8482612613',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          phone: '8482612613',
          smsConsent: true,
          smsMarketingConsent: true,
          smsMarketingConsentAt: expect.any(Date),
          smsOptedOut: false,
          smsOptedOutAt: null,
        }),
      }),
    );
  });

  it('does not mark manually added customers as SMS enabled without a phone number', async () => {
    mockCreateCustomer.mockResolvedValue({
      id: 'cust-2',
      name: 'No Phone',
      email: null,
      phone: null,
      smsConsent: false,
      smsMarketingConsent: false,
      smsOptedOut: false,
      dealSmsBlocked: false,
      groupMemberships: [],
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/customers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'No Phone',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          phone: null,
          smsConsent: false,
          smsMarketingConsent: false,
          smsMarketingConsentAt: null,
          smsOptedOut: false,
          smsOptedOutAt: null,
        }),
      }),
    );
  });
});
