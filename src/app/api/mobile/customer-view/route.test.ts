import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://www.clientific.app'),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    deal: {
      findMany: vi.fn(),
    },
  },
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindDeals = prisma.deal.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
});

describe('GET /api/mobile/customer-view', () => {
  it('returns public customer-facing links for the native app', async () => {
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
    });
    mockFindDeals.mockResolvedValue([
      {
        id: 'deal-1',
        title: 'Spring Special',
        discountType: 'percent_off',
        discountValue: 20,
      },
    ]);

    const response = await GET(new Request('https://www.clientific.app/api/mobile/customer-view'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.storeId).toBe('CF-123');
    expect(body.bookingUrl).toBe('https://www.clientific.app/book/CF-123');
    expect(body.profileUrl).toBe('https://www.clientific.app/business/CF-123');
    expect(body.deals[0]).toMatchObject({
      id: 'deal-1',
      title: 'Spring Special',
      discountLabel: '20% off',
      url: 'https://www.clientific.app/d/deal-1',
    });
  });
});
