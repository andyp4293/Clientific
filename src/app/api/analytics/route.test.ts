import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    checkIn: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    appointment: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    customer: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockCheckInAggregate = prisma.checkIn.aggregate as ReturnType<typeof vi.fn>;
const mockCheckInFindMany = prisma.checkIn.findMany as ReturnType<typeof vi.fn>;
const mockAppointmentCount = prisma.appointment.count as ReturnType<typeof vi.fn>;
const mockAppointmentGroupBy = prisma.appointment.groupBy as ReturnType<typeof vi.fn>;
const mockCustomerCount = prisma.customer.count as ReturnType<typeof vi.fn>;
const mockCustomerGroupBy = prisma.customer.groupBy as ReturnType<typeof vi.fn>;
const mockServiceFindMany = prisma.service.findMany as ReturnType<typeof vi.fn>;

function makeRequest(url = 'http://localhost/api/analytics?range=30d') {
  return new NextRequest(url);
}

function seedAnalyticsMocks() {
  mockCheckInAggregate.mockResolvedValue({ _sum: { amountSpent: 250 } });
  mockAppointmentCount.mockResolvedValue(12);
  mockCustomerCount.mockResolvedValue(4);
  mockCheckInFindMany.mockResolvedValue([]);
  mockAppointmentGroupBy
    .mockResolvedValueOnce([{ status: 'scheduled', _count: 9 }])
    .mockResolvedValueOnce([{ serviceId: 'svc-1', _count: 7 }]);
  mockServiceFindMany.mockResolvedValue([{ id: 'svc-1', name: 'Haircut' }]);
  mockCustomerGroupBy.mockResolvedValue([{ segment: 'NEW', _count: 4 }]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/analytics', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('scopes analytics queries using session.user.businessId when present', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', businessId: 'biz-1' },
    });
    seedAnalyticsMocks();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const aggregateArgs = mockCheckInAggregate.mock.calls[0][0];
    const appointmentsArgs = mockAppointmentCount.mock.calls[0][0];
    const customersArgs = mockCustomerCount.mock.calls[0][0];
    const servicesArgs = mockServiceFindMany.mock.calls[0][0];

    expect(aggregateArgs.where.businessId).toBe('biz-1');
    expect(appointmentsArgs.where.businessId).toBe('biz-1');
    expect(customersArgs.where.businessId).toBe('biz-1');
    expect(servicesArgs.where.businessId).toBe('biz-1');
  });

  it('falls back to session.user.id for legacy sessions without businessId', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'biz-legacy' },
    });
    seedAnalyticsMocks();

    const res = await GET(makeRequest('http://localhost/api/analytics?range=7d'));
    expect(res.status).toBe(200);

    const aggregateArgs = mockCheckInAggregate.mock.calls[0][0];
    expect(aggregateArgs.where.businessId).toBe('biz-legacy');
  });
});

