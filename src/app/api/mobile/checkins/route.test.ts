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
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/checkins', () => ({
  CheckInFlowError: class CheckInFlowError extends Error {
    status: number;
    code?: string;
    customers?: unknown[];

    constructor(message: string, options: { status: number; code?: string; customers?: unknown[] }) {
      super(message);
      this.status = options.status;
      this.code = options.code;
      this.customers = options.customers;
    }
  },
  createBusinessCheckIn: vi.fn(),
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn(() => null),
}));
vi.mock('@/lib/phone', () => ({
  formatPhoneForDisplay: vi.fn((value: string | null | undefined) => value ?? null),
}));

import { createBusinessCheckIn } from '@/lib/checkins';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { GET, POST } from './route';

const mockCreateBusinessCheckIn = createBusinessCheckIn as ReturnType<typeof vi.fn>;
const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindCheckIns = prisma.checkIn.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
  mockFindBusiness.mockResolvedValue({
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'ABC Nails',
    publicId: 'CF-8QXLBD',
    businessType: 'Salon',
    phone: '+15551234567',
    street: '1 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    country: 'United States',
    timezone: 'America/New_York',
  });
  mockFindCheckIns.mockResolvedValue([
    {
      id: 'check-1',
      checkInTime: new Date('2026-03-30T14:00:00.000Z'),
      amountSpent: 45,
      customer: {
        id: 'cust-1',
        name: 'Jordan Lee',
        phone: '+15551234567',
        lastVisit: new Date('2026-03-20T14:00:00.000Z'),
      },
      service: {
        id: 'svc-1',
        name: 'Haircut',
      },
      staff: {
        id: 'staff-1',
        fullName: 'Taylor',
      },
    },
  ]);
  mockCreateBusinessCheckIn.mockResolvedValue({
    checkIn: {
      id: 'check-2',
      customerId: 'cust-1',
      checkInTime: new Date('2026-03-30T15:00:00.000Z'),
      amountSpent: null,
      customer: {
        id: 'cust-1',
        name: 'Jordan Lee',
        phone: '+15551234567',
        lastVisit: new Date('2026-03-30T15:00:00.000Z'),
      },
      service: null,
      staff: null,
    },
  });
});

describe('mobile checkins route', () => {
  it('returns a formatted list of recent check-ins', async () => {
    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/checkins?date=2026-03-30', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.count).toBe(1);
    expect(body.business.publicId).toBe('CF-8QXLBD');
    expect(body.checkIns[0]).toEqual(
      expect.objectContaining({
        customerName: 'Jordan Lee',
        serviceName: 'Haircut',
        staffName: 'Taylor',
      }),
    );
  });

  it('creates a mobile check-in for an existing customer', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/checkins', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customerId: 'cust-1',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(mockCreateBusinessCheckIn).toHaveBeenCalledWith({
      businessId: 'biz-1',
      customerId: 'cust-1',
      customerEmail: undefined,
      customerName: undefined,
      phone: undefined,
    });
    expect(body.checkIn.customerName).toBe('Jordan Lee');
  });
});
