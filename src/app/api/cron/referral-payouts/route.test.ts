import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/referral-payouts', () => ({
  DEFAULT_REFERRAL_RECONCILIATION_LOOKBACK_DAYS: 45,
  reconcileReferralCommissions: vi.fn(),
  retryPendingReferralTransfers: vi.fn(),
}));

import {
  reconcileReferralCommissions,
  retryPendingReferralTransfers,
} from '@/lib/referral-payouts';
import { GET } from './route';

const mockReconcileReferralCommissions =
  reconcileReferralCommissions as ReturnType<typeof vi.fn>;
const mockRetryPendingReferralTransfers =
  retryPendingReferralTransfers as ReturnType<typeof vi.fn>;

function makeRequest(url = 'http://localhost/api/cron/referral-payouts', auth = 'test-secret') {
  return new NextRequest(url, {
    headers: {
      authorization: `Bearer ${auth}`,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret';
  mockReconcileReferralCommissions.mockResolvedValue({
    since: '2026-03-01T00:00:00.000Z',
    scannedInvoices: 2,
    matchedReferralInvoices: 1,
    createdCommissions: 1,
    duplicateInvoices: 0,
    skippedWithoutCustomer: 0,
    skippedWithoutReferral: 1,
    skippedZeroAmount: 0,
    skippedNonSubscription: 0,
  });
  mockRetryPendingReferralTransfers.mockResolvedValue({
    eligibleBusinesses: 1,
    transferredAmount: 870,
    transferredCount: 1,
  });
});

describe('GET /api/cron/referral-payouts', () => {
  it('returns 503 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(new NextRequest('http://localhost/api/cron/referral-payouts'));

    expect(res.status).toBe(503);
  });

  it('returns 401 when the authorization header is wrong', async () => {
    const res = await GET(makeRequest(undefined, 'wrong-secret'));

    expect(res.status).toBe(401);
  });

  it('returns 400 when lookbackDays is invalid', async () => {
    const res = await GET(
      makeRequest('http://localhost/api/cron/referral-payouts?lookbackDays=0')
    );

    expect(res.status).toBe(400);
  });

  it('runs reconciliation and retry with the default lookback window', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(mockReconcileReferralCommissions).toHaveBeenCalledWith({
      lookbackDays: 45,
    });
    expect(mockRetryPendingReferralTransfers).toHaveBeenCalledOnce();

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.lookbackDays).toBe(45);
    expect(body.transferRetry.transferredAmount).toBe(870);
  });

  it('allows overriding the lookback window for manual backfills', async () => {
    const res = await GET(
      makeRequest('http://localhost/api/cron/referral-payouts?lookbackDays=60')
    );

    expect(res.status).toBe(200);
    expect(mockReconcileReferralCommissions).toHaveBeenCalledWith({
      lookbackDays: 60,
    });
  });
});
