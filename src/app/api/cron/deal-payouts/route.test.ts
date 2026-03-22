import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/deal-payouts', () => ({
  retryPendingDealPurchaseTransfers: vi.fn(),
}));

import { retryPendingDealPurchaseTransfers } from '@/lib/deal-payouts';
import { GET } from './route';

const mockRetryPendingDealPurchaseTransfers =
  retryPendingDealPurchaseTransfers as ReturnType<typeof vi.fn>;

function makeRequest(
  url = 'http://localhost/api/cron/deal-payouts',
  auth = 'test-secret'
) {
  return new NextRequest(url, {
    headers: {
      authorization: `Bearer ${auth}`,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret';
  mockRetryPendingDealPurchaseTransfers.mockResolvedValue({
    eligibleBusinesses: 2,
    transferredAmount: 128,
    transferredCount: 1,
    automaticCount: 1,
    failedCount: 0,
  });
});

describe('GET /api/cron/deal-payouts', () => {
  it('returns 503 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(new NextRequest('http://localhost/api/cron/deal-payouts'));

    expect(res.status).toBe(503);
  });

  it('returns 401 when the bearer token is invalid', async () => {
    const res = await GET(makeRequest('http://localhost/api/cron/deal-payouts', 'wrong-secret'));

    expect(res.status).toBe(401);
  });

  it('runs the retry job and returns the summary', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.transferRetry).toEqual({
      eligibleBusinesses: 2,
      transferredAmount: 128,
      transferredCount: 1,
      automaticCount: 1,
      failedCount: 0,
    });
  });

  it('returns 500 when the retry job throws', async () => {
    mockRetryPendingDealPurchaseTransfers.mockRejectedValue(new Error('Stripe down'));

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });
});
