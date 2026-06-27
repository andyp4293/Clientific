import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    customerGroup: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { DELETE, GET, PUT } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindCustomer = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockUpdateCustomer = prisma.customer.update as ReturnType<typeof vi.fn>;
const mockDeleteCustomer = prisma.customer.delete as ReturnType<typeof vi.fn>;

const customerRecord = {
  id: 'cust-1',
  name: 'Jordan Lee',
  email: 'jordan@example.com',
  phone: '+15551234567',
  birthday: null,
  notes: 'VIP guest',
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
  groupMemberships: [],
  checkIns: [
    {
      id: 'check-1',
      createdAt: new Date('2026-03-28T14:00:00.000Z'),
      amountSpent: 45,
    },
  ],
  appointments: [
    {
      id: 'appt-1',
      startTime: new Date('2026-03-27T16:00:00.000Z'),
      status: 'COMPLETED',
      service: {
        name: 'Haircut',
      },
      staff: {
        fullName: 'Taylor',
      },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
});

describe('GET /api/mobile/customers/[id]', () => {
  it('returns the native customer detail payload', async () => {
    mockFindCustomer.mockResolvedValue(customerRecord);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/customers/cust-1'),
      { params: Promise.resolve({ id: 'cust-1' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.customer).toMatchObject({
      id: 'cust-1',
      segmentLabel: 'VIP',
      smsMarketingConsent: true,
      visitsCount: 3,
      appointmentsCount: 2,
    });
    expect(body.customer.checkIns[0].amountSpentLabel).toBe('$45.00');
  });
});

describe('PUT /api/mobile/customers/[id]', () => {
  it('updates a customer and returns the refreshed detail payload', async () => {
    mockFindCustomer
      .mockResolvedValueOnce({ id: 'cust-1' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...customerRecord,
        name: 'Jordan Smith',
      });
    mockUpdateCustomer.mockResolvedValue({ id: 'cust-1' });

    const response = await PUT(
      new Request('https://www.clientific.app/api/mobile/customers/cust-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Jordan Smith',
          email: 'jordan@example.com',
          phone: '(555) 123-4567',
          groupIds: [],
        }),
      }),
      { params: Promise.resolve({ id: 'cust-1' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.customer.name).toBe('Jordan Smith');
  });
});

describe('DELETE /api/mobile/customers/[id]', () => {
  it('deletes the customer when it belongs to the signed-in business', async () => {
    mockFindCustomer.mockResolvedValue({ id: 'cust-1' });

    const response = await DELETE(
      new Request('https://www.clientific.app/api/mobile/customers/cust-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'cust-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockDeleteCustomer).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
    });
  });
});
