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

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockAggregateCheckIns = prisma.checkIn.aggregate as ReturnType<typeof vi.fn>;
const mockFindCheckIns = prisma.checkIn.findMany as ReturnType<typeof vi.fn>;
const mockCountAppointments = prisma.appointment.count as ReturnType<typeof vi.fn>;
const mockGroupAppointments = prisma.appointment.groupBy as ReturnType<typeof vi.fn>;
const mockCountCustomers = prisma.customer.count as ReturnType<typeof vi.fn>;
const mockGroupCustomers = prisma.customer.groupBy as ReturnType<typeof vi.fn>;
const mockFindServices = prisma.service.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
});

describe('GET /api/mobile/analytics', () => {
  it('returns range-aware analytics summaries for the mobile dashboard', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
    });
    mockAggregateCheckIns.mockResolvedValue({ _sum: { amountSpent: 1200 } });
    mockCountAppointments.mockResolvedValue(18);
    mockCountCustomers.mockResolvedValue(6);
    mockFindCheckIns.mockResolvedValue([
      { checkInTime: new Date('2026-03-05T12:00:00.000Z'), amountSpent: 400 },
      { checkInTime: new Date('2026-03-12T12:00:00.000Z'), amountSpent: 800 },
    ]);
    mockGroupAppointments
      .mockResolvedValueOnce([{ status: 'confirmed', _count: 10 }])
      .mockResolvedValueOnce([{ serviceId: 'svc-1', _count: 8 }]);
    mockFindServices.mockResolvedValue([{ id: 'svc-1', name: 'Haircut' }]);
    mockGroupCustomers.mockResolvedValue([{ segment: 'new', _count: 6 }]);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/analytics?range=90d', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.range).toBe('90d');
    expect(body.stats).toMatchObject({
      totalRevenue: 1200,
      totalAppointments: 18,
      newCustomers: 6,
    });
    expect(body.appointmentsByStatus).toEqual([
      { status: 'confirmed', label: 'Confirmed', count: 10 },
    ]);
    expect(body.topServices).toEqual([
      { name: 'Haircut', count: 8, share: 100 },
    ]);
    expect(body.customerSegments).toEqual([
      { segment: 'new', label: 'new', count: 6 },
    ]);
    expect(body.revenueByWeek.length).toBeGreaterThan(0);
  });
});
