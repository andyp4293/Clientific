import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    checkIn: { findMany: vi.fn(), create: vi.fn() },
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/segment', () => ({ updateCustomerSegment: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/timezone', () => ({ businessDayStart: vi.fn((date: string) => new Date(date)) }));
vi.mock('@/lib/subscription', () => ({ requireActiveSubscription: vi.fn() }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { GET, POST } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockRequireActiveSubscription = requireActiveSubscription as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCheckInFindMany = prisma.checkIn.findMany as ReturnType<typeof vi.fn>;
const mockCheckInCreate = prisma.checkIn.create as ReturnType<typeof vi.fn>;
const mockCustomerFindMany = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockCustomerFindFirst = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockCustomerCreate = prisma.customer.create as ReturnType<typeof vi.fn>;
const mockCustomerUpdate = prisma.customer.update as ReturnType<typeof vi.fn>;

const activeSession = { user: { businessId: 'biz-1' } };

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/checkins', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockRequireActiveSubscription.mockResolvedValue(null);
});

describe('GET /api/checkins', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/checkins'));
    expect(res.status).toBe(401);
  });

  it('returns checkins for an authenticated business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue({ timezone: 'America/New_York' });
    mockCheckInFindMany.mockResolvedValue([{ id: 'ci-1', customerId: 'cust-1' }]);

    const res = await GET(new Request('http://localhost/api/checkins'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.timezone).toBe('America/New_York');
    expect(body.checkIns).toHaveLength(1);
  });
});

describe('POST /api/checkins', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ customerId: 'cust-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when a new phone number is missing customer details', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockCustomerFindMany.mockResolvedValue([]);

    const res = await POST(makeRequest({ phone: '8482612613' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('CUSTOMER_DETAILS_REQUIRED');
  });

  it('returns 400 when the provided phone number is not valid enough to normalize', async () => {
    mockSession.mockResolvedValue(activeSession);

    const res = await POST(makeRequest({ phone: '555' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Customer phone number required');
    expect(mockCustomerFindMany).not.toHaveBeenCalled();
  });

  it('returns 409 when multiple customers already match the same normalized phone', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockCustomerFindMany.mockResolvedValue([
      { id: 'cust-1', name: 'Andy', phone: '+18482612613', phoneLookupKey: '8482612613' },
      { id: 'cust-2', name: 'Andy 2', phone: '8482612613', phoneLookupKey: '8482612613' },
    ]);

    const res = await POST(makeRequest({ phone: '+18482612613' }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('MULTIPLE_CUSTOMERS_MATCH_PHONE');
  });

  it('checks in an existing customer when the database stored the number without +1', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockCustomerFindMany.mockResolvedValue([
      { id: 'cust-1', name: 'Andy', phone: '8482612613', phoneLookupKey: null },
    ]);
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-1',
      phone: '8482612613',
      phoneLookupKey: null,
    });
    mockCheckInCreate.mockResolvedValue({
      id: 'ci-1',
      customer: { id: 'cust-1' },
      service: null,
      staff: null,
    });
    mockCustomerUpdate.mockResolvedValue({ id: 'cust-1' });

    const res = await POST(makeRequest({ phone: '+18482612613' }));

    expect(res.status).toBe(200);
    expect(mockCustomerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { phoneLookupKey: '8482612613' },
            { phone: '+18482612613' },
            { phone: '18482612613' },
          ]),
        }),
      })
    );
    expect(mockCustomerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-1' },
        data: expect.objectContaining({
          phone: '8482612613',
          phoneLookupKey: '8482612613',
        }),
      })
    );
  });

  it('creates a new customer from phone-first check-in and stores normalized phone data', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockCustomerFindMany.mockResolvedValue([]);
    mockCustomerCreate.mockResolvedValue({ id: 'cust-new' });
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-new',
      phone: '8482612613',
      phoneLookupKey: '8482612613',
    });
    mockCheckInCreate.mockResolvedValue({
      id: 'ci-new',
      customer: { id: 'cust-new' },
      service: null,
      staff: null,
    });
    mockCustomerUpdate.mockResolvedValue({ id: 'cust-new' });

    const res = await POST(
      makeRequest({
        phone: '8482612613',
        customerName: 'New Customer',
        customerEmail: 'customer@example.com',
      })
    );

    expect(res.status).toBe(200);
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'New Customer',
          email: 'customer@example.com',
          phone: '8482612613',
          phoneLookupKey: '8482612613',
        }),
      })
    );
  });

  it('updates the selected customer phone when customerId and a normalized phone are both provided', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-1',
      phone: null,
      phoneLookupKey: null,
    });
    mockCheckInCreate.mockResolvedValue({
      id: 'ci-1',
      customer: { id: 'cust-1' },
      service: null,
      staff: null,
    });
    mockCustomerUpdate.mockResolvedValue({ id: 'cust-1' });

    const res = await POST(makeRequest({ customerId: 'cust-1', phone: '8482612613' }));

    expect(res.status).toBe(200);
    expect(mockCustomerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-1' },
        data: expect.objectContaining({
          phone: '8482612613',
          phoneLookupKey: '8482612613',
        }),
      })
    );
  });

  it('still allows detailed check-in by customerId without forcing a phone number', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-1',
      phone: null,
      phoneLookupKey: null,
    });
    mockCheckInCreate.mockResolvedValue({
      id: 'ci-1',
      customer: { id: 'cust-1' },
      service: { id: 'svc-1', name: 'Gel Manicure' },
      staff: null,
    });
    mockCustomerUpdate.mockResolvedValue({ id: 'cust-1' });

    const res = await POST(
      makeRequest({
        customerId: 'cust-1',
        serviceId: 'svc-1',
        amountSpent: 45,
      })
    );

    expect(res.status).toBe(200);
    expect(mockCheckInCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust-1',
          serviceId: 'svc-1',
          amountSpent: 45,
        }),
      })
    );
  });
});
