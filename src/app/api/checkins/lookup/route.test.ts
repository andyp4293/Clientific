import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: { findMany: vi.fn() },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockCustomerFindMany = prisma.customer.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

function makeRequest(phone: string) {
  return new NextRequest(`http://localhost/api/checkins/lookup?phone=${encodeURIComponent(phone)}`);
}

describe('GET /api/checkins/lookup', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(makeRequest('8482612613'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid phone number', async () => {
    mockSession.mockResolvedValue({ user: { businessId: 'biz-1' } });
    const res = await GET(makeRequest('123'));
    expect(res.status).toBe(400);
  });

  it('returns new for an unknown number and formats it for display', async () => {
    mockSession.mockResolvedValue({ user: { businessId: 'biz-1' } });
    mockCustomerFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest('8482612613'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('new');
    expect(body.displayPhone).toBe('(848) 261-2613');
  });

  it('returns the existing customer when +1 and plain digits refer to the same record', async () => {
    mockSession.mockResolvedValue({ user: { businessId: 'biz-1' } });
    mockCustomerFindMany.mockResolvedValue([
      { id: 'cust-1', name: 'Andy', phone: '8482612613', email: null, lastVisit: null },
    ]);

    const res = await GET(makeRequest('+18482612613'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('existing');
    expect(mockCustomerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { phoneLookupKey: '8482612613' },
            { phone: '+18482612613' },
          ]),
        }),
      })
    );
  });

  it('returns multiple when more than one record shares the normalized phone', async () => {
    mockSession.mockResolvedValue({ user: { businessId: 'biz-1' } });
    mockCustomerFindMany.mockResolvedValue([
      { id: 'cust-1', name: 'Andy', phone: '+18482612613', email: null, lastVisit: null },
      { id: 'cust-2', name: 'Andy 2', phone: '8482612613', email: null, lastVisit: null },
    ]);

    const res = await GET(makeRequest('8482612613'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('multiple');
    expect(body.customers).toHaveLength(2);
  });

  it('accepts 11-digit US numbers with a leading 1 and formats them like local numbers', async () => {
    mockSession.mockResolvedValue({ user: { businessId: 'biz-1' } });
    mockCustomerFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest('18482612613'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('new');
    expect(body.normalizedPhone).toBe('8482612613');
    expect(body.displayPhone).toBe('(848) 261-2613');
  });
});
