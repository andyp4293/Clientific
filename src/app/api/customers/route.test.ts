import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/twilio-keyword-sync', () => ({
  startRecentTwilioKeywordSync: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { startRecentTwilioKeywordSync } from '@/lib/twilio-keyword-sync';
import { GET } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockFindCustomers = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockStartRecentTwilioKeywordSync =
  startRecentTwilioKeywordSync as ReturnType<typeof vi.fn>;

describe('GET /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: {
        businessId: 'biz-1',
      },
    });
    mockStartRecentTwilioKeywordSync.mockImplementation(() => undefined);
    mockFindCustomers.mockResolvedValue([]);
  });

  it('starts background keyword sync before returning customers', async () => {
    const response = await GET(new Request('https://www.clientific.app/api/customers'));

    expect(response.status).toBe(200);
    expect(mockStartRecentTwilioKeywordSync).toHaveBeenCalledTimes(1);
    expect(mockFindCustomers).toHaveBeenCalledTimes(1);
  });

  it('still returns customers when the background sync starter throws', async () => {
    mockStartRecentTwilioKeywordSync.mockImplementation(() => {
      throw new Error('twilio slow');
    });

    const response = await GET(new Request('https://www.clientific.app/api/customers'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      customers: [],
    });
    expect(mockFindCustomers).toHaveBeenCalledTimes(1);
  });
});
