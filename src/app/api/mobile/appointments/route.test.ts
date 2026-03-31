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
    appointment: {
      findMany: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/appointment-services', () => ({
  collectAppointmentServiceIds: vi.fn(() => ['svc-1']),
  withAppointmentServiceDisplay: vi.fn((appointments: unknown[]) => appointments),
}));

import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindAppointments = prisma.appointment.findMany as ReturnType<typeof vi.fn>;
const mockFindServices = prisma.service.findMany as ReturnType<typeof vi.fn>;

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
    timezone: 'America/New_York',
  });
  mockFindAppointments.mockResolvedValue([
    {
      id: 'appt-1',
      startTime: new Date('2026-03-30T14:00:00.000Z'),
      endTime: new Date('2026-03-30T15:00:00.000Z'),
      status: 'confirmed',
      source: 'dashboard',
      notes: 'Color touch-up',
      serviceDisplayName: 'Color',
      customer: {
        id: 'cust-1',
        name: 'Jordan Lee',
      },
      service: {
        id: 'svc-1',
        name: 'Color',
      },
      staff: {
        id: 'staff-1',
        fullName: 'Taylor',
      },
    },
  ]);
  mockFindServices.mockResolvedValue([{ id: 'svc-1', name: 'Color' }]);
});

describe('mobile appointments route', () => {
  it('returns a formatted daily appointment summary', async () => {
    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/appointments?date=2026-03-30', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.selectedDate).toBe('2026-03-30');
    expect(body.counts.total).toBe(1);
    expect(body.counts.confirmed).toBe(1);
    expect(body.appointments[0]).toEqual(
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Color',
        statusLabel: 'Confirmed',
        sourceLabel: 'Manual',
      }),
    );
  });
});
