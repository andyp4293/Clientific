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
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import CheckInPage from './page';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;

describe('CheckInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Test Salon',
      publicId: 'pub_123',
      logoUrl: null,
    });
  });

  it('marks the check-in page as manageable for the owning business session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        businessId: 'biz-1',
      },
    });

    const element = await CheckInPage({
      params: Promise.resolve({ publicId: 'pub_123' }),
    });

    expect(element.props.viewerCanManage).toBe(true);
  });

  it('keeps the check-in page public when the business is not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const element = await CheckInPage({
      params: Promise.resolve({ publicId: 'pub_123' }),
    });

    expect(element.props.viewerCanManage).toBe(false);
  });
});
