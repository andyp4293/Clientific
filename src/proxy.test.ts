import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { resetRateLimitStore } from './lib/rate-limit';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

function request(pathname: string, ip = '203.0.113.80') {
  return new NextRequest(`https://www.clientific.app${pathname}`, {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
      'user-agent': 'vitest-proxy',
    },
  });
}

describe('proxy rate limiting', () => {
  afterEach(() => {
    resetRateLimitStore();
    vi.unstubAllEnvs();
  });

  it('returns a JSON 429 before protected API handlers are reached', async () => {
    vi.stubEnv('RATE_LIMIT_PERSISTENT_DISABLED', 'true');
    let response = await proxy(request('/api/mobile/auth/login'));

    for (let index = 0; index < 8; index += 1) {
      response = await proxy(request('/api/mobile/auth/login'));
    }

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.json()).toEqual({
      error: 'Too many sign-in or account attempts. Please wait a minute and try again.',
      code: 'RATE_LIMITED',
    });
  });
});
