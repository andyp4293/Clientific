import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/review-requests', () => ({
  processPendingCheckInReviewRequests: vi.fn(),
}));

import { processPendingCheckInReviewRequests } from '@/lib/review-requests';
import { GET } from './route';

const mockProcessPendingCheckInReviewRequests =
  processPendingCheckInReviewRequests as ReturnType<typeof vi.fn>;

function makeRequest(
  url = 'http://localhost/api/cron/review-requests',
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
  mockProcessPendingCheckInReviewRequests.mockResolvedValue({
    ok: true,
    ranAt: '2026-03-28T16:00:00.000Z',
    cutoff: '2026-03-28T14:00:00.000Z',
    scanned: 4,
    sent: 2,
    skippedNoPhoneOrConsent: 1,
    skippedNoSurveyLink: 0,
    skippedTopRated: 1,
    failed: 0,
  });
});

describe('GET /api/cron/review-requests', () => {
  it('returns 503 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(new NextRequest('http://localhost/api/cron/review-requests'));

    expect(res.status).toBe(503);
  });

  it('returns 401 when the bearer token is invalid', async () => {
    const res = await GET(makeRequest(undefined, 'wrong-secret'));

    expect(res.status).toBe(401);
  });

  it('runs the post-check-in survey job and returns the summary', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(body.skippedTopRated).toBe(1);
    expect(mockProcessPendingCheckInReviewRequests).toHaveBeenCalledOnce();
  });

  it('returns 500 when the survey job throws', async () => {
    mockProcessPendingCheckInReviewRequests.mockRejectedValue(new Error('Twilio down'));

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });
});
