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
    businessHours: {
      findUnique: vi.fn(),
    },
    businessClosureDate: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET, PATCH } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindBusinessHours = prisma.businessHours.findUnique as ReturnType<typeof vi.fn>;
const mockFindClosures = prisma.businessClosureDate.findMany as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
});

describe('mobile business hours routes', () => {
  it('returns weekly hours and closure summaries', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      timezone: 'America/New_York',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
    });
    mockFindBusinessHours.mockResolvedValue({
      businessId: 'biz-1',
      hours: {
        1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
    });
    mockFindClosures.mockResolvedValue([
      { date: '2026-04-01', label: 'Holiday' },
    ]);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/business-hours', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const monday = body.hours.find((hour: { dayOfWeek: number }) => hour.dayOfWeek === 1);
    expect(body.timezone).toBe('America/New_York');
    expect(monday).toMatchObject({
      dayOfWeek: 1,
      label: 'Monday',
      timeRangeLabel: '9:00 AM - 5:00 PM',
    });
    expect(body.closures[0]).toMatchObject({
      date: '2026-04-01',
      label: 'Holiday',
    });
  });

  it('updates hours and closures through the native patch flow', async () => {
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        businessHours: {
          upsert: vi.fn().mockResolvedValue(undefined),
        },
        businessClosureDate: {
          deleteMany: vi.fn().mockResolvedValue(undefined),
          createMany: vi.fn().mockResolvedValue(undefined),
        },
      }),
    );
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      timezone: 'America/New_York',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
    });
    mockFindBusinessHours.mockResolvedValue({
      businessId: 'biz-1',
      hours: {
        1: { isOpen: true, openTime: '10:00', closeTime: '18:00' },
      },
    });
    mockFindClosures.mockResolvedValue([
      { date: '2026-04-15', label: 'Team retreat' },
    ]);

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/business-hours', {
        method: 'PATCH',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({
          hours: [
            {
              dayOfWeek: 1,
              isOpen: true,
              openTime: '10:00',
              closeTime: '18:00',
            },
          ],
          closures: [
            {
              date: '2026-04-15',
              label: 'Team retreat',
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const monday = body.hours.find((hour: { dayOfWeek: number }) => hour.dayOfWeek === 1);
    expect(body.success).toBe(true);
    expect(monday).toMatchObject({
      dayOfWeek: 1,
      openTime: '10:00',
      closeTime: '18:00',
    });
    expect(body.closures[0]).toMatchObject({
      date: '2026-04-15',
      label: 'Team retreat',
    });
  });
});
