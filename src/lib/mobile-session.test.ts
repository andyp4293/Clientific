import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMobileSessionToken,
  getBearerToken,
  verifyMobileSessionToken,
} from './mobile-session';

describe('mobile session token helpers', () => {
  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
  });

  it('creates and verifies a mobile session token', async () => {
    const token = await createMobileSessionToken({
      businessId: 'biz-123',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      onboardingComplete: true,
    });

    const payload = await verifyMobileSessionToken(token);
    expect(payload.businessId).toBe('biz-123');
    expect(payload.email).toBe('owner@clientific.app');
    expect(payload.onboardingComplete).toBe(true);
    expect(payload.accountType).toBe('owner');
  });

  it('preserves staff viewer claims for appointment-only sessions', async () => {
    const token = await createMobileSessionToken({
      businessId: 'biz-123',
      email: 'taylor@example.com',
      name: 'Taylor',
      onboardingComplete: true,
      accountType: 'staff',
      staffId: 'staff-123',
      staffName: 'Taylor Nguyen',
    });

    const payload = await verifyMobileSessionToken(token);

    expect(payload).toEqual(
      expect.objectContaining({
        businessId: 'biz-123',
        accountType: 'staff',
        staffId: 'staff-123',
        staffName: 'Taylor Nguyen',
      }),
    );
  });

  it('extracts a bearer token from a request', () => {
    const request = new Request('https://www.clientific.app/api/mobile/dashboard/summary', {
      headers: { authorization: 'Bearer sample-token' },
    });

    expect(getBearerToken(request)).toBe('sample-token');
  });

  it('returns null when a bearer token is missing', () => {
    const request = new Request('https://www.clientific.app/api/mobile/dashboard/summary');
    expect(getBearerToken(request)).toBeNull();
  });
});
