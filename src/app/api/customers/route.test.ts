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
  syncRecentTwilioKeywordMessages: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { syncRecentTwilioKeywordMessages } from '@/lib/twilio-keyword-sync';
import { GET } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockFindCustomers = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockSyncRecentTwilioKeywordMessages =
  syncRecentTwilioKeywordMessages as ReturnType<typeof vi.fn>;

describe('GET /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: {
        businessId: 'biz-1',
      },
    });
    mockSyncRecentTwilioKeywordMessages.mockResolvedValue(undefined);
    mockFindCustomers.mockResolvedValue([]);
  });

  it('reconciles missed Twilio keyword events before returning customers', async () => {
    const response = await GET(new Request('https://www.clientific.app/api/customers'));

    expect(response.status).toBe(200);
    expect(mockSyncRecentTwilioKeywordMessages).toHaveBeenCalledTimes(1);
    expect(mockFindCustomers).toHaveBeenCalledTimes(1);
  });
});
