import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, getClientIp, resetRateLimitStore } from './rate-limit';

function headers(values: Record<string, string> = {}) {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    get(name: string) {
      return normalized.get(name.toLowerCase()) ?? null;
    },
  };
}

function hit(
  pathname: string,
  {
    method = 'GET',
    ip = '203.0.113.10',
    now = 1_800_000_000_000,
    userAgent = 'vitest-agent',
  }: {
    method?: string;
    ip?: string;
    now?: number;
    userAgent?: string;
  } = {},
) {
  return checkRateLimit({
    pathname,
    method,
    now,
    headers: headers({
      'x-forwarded-for': ip,
      'user-agent': userAgent,
    }),
  });
}

describe('rate limiting', () => {
  afterEach(() => {
    resetRateLimitStore();
    vi.unstubAllEnvs();
  });

  it('prefers real client IP headers before generic proxy forwarding', () => {
    expect(
      getClientIp(
        headers({
          'cf-connecting-ip': '198.51.100.10',
          'x-forwarded-for': '198.51.100.20, 10.0.0.1',
          'x-real-ip': '198.51.100.99',
        }),
      ),
    ).toBe('198.51.100.10');
  });

  it('falls back through proxy-provided IP headers in a stable order', () => {
    expect(
      getClientIp(
        headers({
          'x-forwarded-for': '198.51.100.20, 10.0.0.1',
          'x-real-ip': '198.51.100.99',
        }),
      ),
    ).toBe('198.51.100.99');

    expect(
      getClientIp(
        headers({
          'x-forwarded-for': '198.51.100.20, 10.0.0.1',
        }),
      ),
    ).toBe('198.51.100.20');
  });

  it('bypasses signed provider webhooks, cron routes, auth session checks, and CORS preflights', () => {
    expect(hit('/api/webhooks/stripe', { method: 'POST' }).allowed).toBe(true);
    expect(hit('/api/cron/appointment-reminders', { method: 'GET' }).allowed).toBe(true);
    expect(hit('/api/auth/session', { method: 'GET' }).allowed).toBe(true);
    expect(hit('/api/customers', { method: 'OPTIONS' }).allowed).toBe(true);
  });

  it('rate limits repeated auth mutations before brute force attempts can keep hitting handlers', () => {
    let decision = hit('/api/mobile/auth/login', { method: 'POST' });

    for (let index = 0; index < 8; index += 1) {
      decision = hit('/api/mobile/auth/login', { method: 'POST' });
    }

    expect(decision.allowed).toBe(false);
    expect(decision.policyId).toBe('auth-burst');
    expect(decision.headers['Retry-After']).toBe('60');
    expect(decision.message).toContain('sign-in');
  });

  it('keeps auth limits isolated by client IP', () => {
    for (let index = 0; index < 8; index += 1) {
      expect(hit('/api/auth/register', { method: 'POST', ip: '203.0.113.11' }).allowed).toBe(
        true,
      );
    }

    expect(hit('/api/auth/register', { method: 'POST', ip: '203.0.113.12' }).allowed).toBe(true);
  });

  it('rate limits public booking writes separately from read-only slot checks', () => {
    for (let index = 0; index < 35; index += 1) {
      expect(
        hit('/api/public/business/northfield/book', {
          method: 'POST',
          ip: '203.0.113.30',
        }).allowed,
      ).toBe(true);
    }

    const blocked = hit('/api/public/business/northfield/book', {
      method: 'POST',
      ip: '203.0.113.30',
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.policyId).toBe('public-write');

    expect(
      hit('/api/public/business/northfield/available-slots', {
        method: 'GET',
        ip: '203.0.113.31',
      }).allowed,
    ).toBe(true);
  });

  it('applies a stricter billing and payout bucket for payment-sensitive APIs', () => {
    for (let index = 0; index < 45; index += 1) {
      expect(hit('/api/deal-purchases/earnings', { ip: '203.0.113.40' }).allowed).toBe(true);
    }

    const blocked = hit('/api/deal-purchases/earnings', { ip: '203.0.113.40' });
    expect(blocked.allowed).toBe(false);
    expect(blocked.policyId).toBe('payment-sensitive');
    expect(blocked.headers['X-RateLimit-Limit']).toBe('45');
  });

  it('protects the broad API surface with a global burst limit', () => {
    for (let index = 0; index < 180; index += 1) {
      expect(hit('/api/customers', { ip: '203.0.113.50' }).allowed).toBe(true);
    }

    const blocked = hit('/api/customers', { ip: '203.0.113.50' });
    expect(blocked.allowed).toBe(false);
    expect(blocked.policyId).toBe('api-global-burst');
  });

  it('allows explicit trusted IP bypasses for monitors or internal admin networks', () => {
    vi.stubEnv('RATE_LIMIT_TRUSTED_IPS', '203.0.113.60');

    for (let index = 0; index < 250; index += 1) {
      expect(hit('/api/customers', { ip: '203.0.113.60' }).allowed).toBe(true);
    }
  });
});
