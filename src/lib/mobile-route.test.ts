import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));

import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { requireMobileSession } from './mobile-route';

const mockGetBearerToken = vi.mocked(getBearerToken);
const mockVerifyMobileSessionToken = vi.mocked(verifyMobileSessionToken);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({
    businessId: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    onboardingComplete: true,
    accountType: 'owner',
    staffId: null,
    staffName: null,
  });
});

describe('requireMobileSession', () => {
  it('allows owner sessions by default', async () => {
    const authorized = await requireMobileSession(
      new Request('https://www.clientific.app/api/mobile/customers'),
    );

    expect('session' in authorized).toBe(true);
  });

  it('blocks staff sessions unless the route explicitly opts in', async () => {
    mockVerifyMobileSessionToken.mockResolvedValue({
      businessId: 'biz-1',
      email: 'taylor@example.com',
      name: 'Taylor',
      onboardingComplete: true,
      accountType: 'staff',
      staffId: 'staff-1',
      staffName: 'Taylor',
    });

    const denied = await requireMobileSession(
      new Request('https://www.clientific.app/api/mobile/customers'),
    );
    expect('error' in denied).toBe(true);
    if ('error' in denied) {
      expect(denied.error?.status).toBe(403);
    }

    const allowed = await requireMobileSession(
      new Request('https://www.clientific.app/api/mobile/appointments'),
      { allowStaff: true },
    );
    expect('session' in allowed).toBe(true);
  });
});
