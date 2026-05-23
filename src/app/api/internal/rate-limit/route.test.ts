import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/rate-limit-db', () => ({
  checkDatabaseRateLimit: vi.fn(),
  headersFromRateLimitPayload: vi.fn((payload) => ({
    get(name: string) {
      if (name === 'x-forwarded-for') return payload.ip ?? null;
      if (name === 'user-agent') return payload.userAgent ?? null;
      return null;
    },
  })),
}));

import { checkDatabaseRateLimit } from '@/lib/rate-limit-db';

const checkDatabaseRateLimitMock = checkDatabaseRateLimit as ReturnType<typeof vi.fn>;

function request(body: Record<string, unknown>, secret = 'test-secret') {
  return new Request('https://www.clientific.app/api/internal/rate-limit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-clientific-internal-rate-limit': secret,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/internal/rate-limit', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('hides the internal endpoint without the shared proxy secret', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');

    const response = await POST(request({ pathname: '/api/customers', method: 'GET' }, 'bad'));

    expect(response.status).toBe(404);
    expect(checkDatabaseRateLimitMock).not.toHaveBeenCalled();
  });

  it('returns persisted rate-limit decisions to the proxy', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
    checkDatabaseRateLimitMock.mockResolvedValue({
      allowed: false,
      policyId: 'auth-burst',
      limit: 8,
      remaining: 0,
      resetAt: 1_800_000_060_000,
      retryAfterSeconds: 60,
      message: 'Too many sign-in or account attempts. Please wait a minute and try again.',
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Limit': '8',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '1800000060',
      },
    });

    const response = await POST(
      request({
        pathname: '/api/mobile/auth/login',
        method: 'POST',
        ip: '203.0.113.92',
        userAgent: 'vitest-route',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.json()).toMatchObject({
      allowed: false,
      policyId: 'auth-burst',
    });
  });
});
