import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    deal: {
      findFirst: vi.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import CapturePage from './page';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockDealFindFirst = prisma.deal.findFirst as ReturnType<typeof vi.fn>;

describe('CapturePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Test Salon',
      publicId: 'pub_123',
      slug: 'test-salon',
      logoUrl: null,
      publicProfileHeadline: 'Join for specials',
      enableOnlineBooking: true,
    });

    mockDealFindFirst.mockResolvedValue({
      id: 'deal-1',
      title: 'Spring Special',
      description: null,
      discountType: 'percent_off',
      discountValue: 20,
      expiresAt: new Date('2026-03-20T00:00:00.000Z'),
      maxRedemptions: null,
      redemptionCount: 0,
      service: { name: 'Gel manicure' },
    });
  });

  it('marks the capture page as manageable for the owning business session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        businessId: 'biz-1',
      },
    });

    const element = await CapturePage({
      params: Promise.resolve({ publicId: 'pub_123' }),
      searchParams: Promise.resolve({ deal: 'deal-1' }),
    });

    expect(element.props.config.viewerCanManage).toBe(true);
  });

  it('keeps the capture page public when the business is not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const element = await CapturePage({
      params: Promise.resolve({ publicId: 'pub_123' }),
      searchParams: Promise.resolve({ deal: 'deal-1' }),
    });

    expect(element.props.config.viewerCanManage).toBe(false);
  });
});
