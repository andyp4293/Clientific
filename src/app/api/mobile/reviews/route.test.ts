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
    smsLog: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://www.clientific.app'),
}));

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindLogs = prisma.smsLog.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
});

describe('GET /api/mobile/reviews', () => {
  it('returns survey links and recent SMS review requests', async () => {
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
      slug: 'clientific-studio',
      publicId: 'CF-123',
      googleReviewUrl: 'https://google.com/review',
      yelpUrl: null,
    });
    mockFindLogs.mockResolvedValue([
      {
        id: 'sms-1',
        toPhone: '+15551234567',
        status: 'delivered',
        createdAt: new Date('2026-03-30T13:45:00.000Z'),
      },
    ]);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/reviews', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.surveyUrl).toBe('https://www.clientific.app/feedback/CF-123');
    expect(body.publicReviewDestinations).toEqual([
      { label: 'Google Reviews', url: 'https://google.com/review' },
    ]);
    expect(body.recentRequests[0]).toMatchObject({
      id: 'sms-1',
      recipientLabel: '(555) 123-4567',
      statusLabel: 'Delivered',
    });
  });
});
