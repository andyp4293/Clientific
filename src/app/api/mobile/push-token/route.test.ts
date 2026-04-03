import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/mobile-push', () => ({
  registerMobilePushDevice: vi.fn(),
  unregisterMobilePushDevice: vi.fn(),
}));

import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import {
  registerMobilePushDevice,
  unregisterMobilePushDevice,
} from '@/lib/mobile-push';
import { DELETE, POST } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockRegisterMobilePushDevice = registerMobilePushDevice as ReturnType<typeof vi.fn>;
const mockUnregisterMobilePushDevice = unregisterMobilePushDevice as ReturnType<typeof vi.fn>;

describe('mobile push token route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBearerToken.mockReturnValue('session-token');
    mockVerifyMobileSessionToken.mockResolvedValue({
      businessId: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      onboardingComplete: true,
    });
    mockRegisterMobilePushDevice.mockResolvedValue(undefined);
    mockUnregisterMobilePushDevice.mockResolvedValue(undefined);
  });

  it('registers a push token for an authenticated mobile business', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/push-token', {
        method: 'POST',
        headers: {
          authorization: 'Bearer session-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          token: 'ExponentPushToken[token-1]',
          platform: 'ios',
          appIdentifier: 'app.clientific.mobile',
          deviceName: 'iPhone 17 Pro',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockRegisterMobilePushDevice).toHaveBeenCalledWith({
      businessId: 'biz-1',
      token: 'ExponentPushToken[token-1]',
      platform: 'ios',
      appIdentifier: 'app.clientific.mobile',
      deviceName: 'iPhone 17 Pro',
    });
  });

  it('rejects missing bearer auth', async () => {
    mockGetBearerToken.mockReturnValue(null);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/push-token', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
  });

  it('unregisters a push token for an authenticated mobile business', async () => {
    const response = await DELETE(
      new Request(
        'https://www.clientific.app/api/mobile/push-token?token=ExponentPushToken%5Btoken-1%5D',
        {
          method: 'DELETE',
          headers: {
            authorization: 'Bearer session-token',
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mockUnregisterMobilePushDevice).toHaveBeenCalledWith({
      businessId: 'biz-1',
      token: 'ExponentPushToken[token-1]',
    });
  });
});
