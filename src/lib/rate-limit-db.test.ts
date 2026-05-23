import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { checkDatabaseRateLimit, headersFromRateLimitPayload } from './rate-limit-db';

const queryRawUnsafe = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

describe('database-backed rate limiting', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('increments shared windows and returns 429 decisions from persisted counts', async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([{ count: 9, resetAt: new Date(1_800_000_060_000) }])
      .mockResolvedValueOnce([{ count: 10, resetAt: new Date(1_800_000_060_000) }]);

    const decision = await checkDatabaseRateLimit({
      pathname: '/api/mobile/auth/login',
      method: 'POST',
      now: 1_800_000_000_000,
      headers: headersFromRateLimitPayload({
        ip: '203.0.113.90',
        userAgent: 'vitest-db',
      }),
    });

    expect(decision.allowed).toBe(false);
    expect(decision.policyId).toBe('auth-burst');
    expect(decision.headers['Retry-After']).toBe('60');
    expect(queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT ("key") DO UPDATE'),
      'auth-burst:203.0.113.90:POST:/api/mobile/auth/login',
      new Date(1_800_000_060_000),
      new Date(1_800_000_000_000),
    );
  });

  it('returns allowed when no rate limit policies apply', async () => {
    const decision = await checkDatabaseRateLimit({
      pathname: '/api/webhooks/stripe',
      method: 'POST',
      headers: headersFromRateLimitPayload({ ip: '203.0.113.91' }),
    });

    expect(decision.allowed).toBe(true);
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });
});
