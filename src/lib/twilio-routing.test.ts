import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const incomingUpdate = vi.fn();
  const incomingList = vi.fn();
  const twilioFactory = vi.fn(() => {
    const incomingPhoneNumbers = ((_: string) => ({
      update: incomingUpdate,
    })) as any;
    incomingPhoneNumbers.list = incomingList;

    return {
      incomingPhoneNumbers,
    };
  });

  return {
    incomingList,
    incomingUpdate,
    twilioFactory,
  };
});

vi.mock('twilio', () => ({
  default: hoisted.twilioFactory,
}));

import { ensureSharedPlatformSmsWebhookConfigured } from '@/lib/twilio-routing';

describe('ensureSharedPlatformSmsWebhookConfigured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & {
      __clientificSharedPlatformSmsWebhookCache?: unknown;
    }).__clientificSharedPlatformSmsWebhookCache;
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_PHONE_NUMBER = '+18557654989';
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & {
      __clientificSharedPlatformSmsWebhookCache?: unknown;
    }).__clientificSharedPlatformSmsWebhookCache;
  });

  it('skips when the public app URL is not reachable', async () => {
    const result = await ensureSharedPlatformSmsWebhookConfigured('http://localhost:3000');

    expect(result).toMatchObject({
      status: 'skipped',
      reason: 'invalid_public_app_url',
      phoneNumber: '+18557654989',
    });
    expect(hoisted.incomingList).not.toHaveBeenCalled();
  });

  it('updates the shared number when the sms webhook is missing', async () => {
    hoisted.incomingList.mockResolvedValueOnce([{ sid: 'PN_shared', smsUrl: null, smsMethod: null }]);
    hoisted.incomingUpdate.mockResolvedValueOnce({});

    const result = await ensureSharedPlatformSmsWebhookConfigured('https://www.clientific.app', {
      force: true,
    });

    expect(result).toMatchObject({
      status: 'updated',
      phoneNumber: '+18557654989',
      smsWebhookUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
    });
    expect(hoisted.incomingList).toHaveBeenCalledWith({
      phoneNumber: '+18557654989',
      limit: 1,
    });
    expect(hoisted.incomingUpdate).toHaveBeenCalledWith({
      smsUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
      smsMethod: 'POST',
    });
  });

  it('does not update when the shared number is already configured correctly', async () => {
    hoisted.incomingList.mockResolvedValueOnce([
      {
        sid: 'PN_shared',
        smsUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
        smsMethod: 'POST',
      },
    ]);

    const result = await ensureSharedPlatformSmsWebhookConfigured('https://www.clientific.app', {
      force: true,
    });

    expect(result.status).toBe('unchanged');
    expect(hoisted.incomingUpdate).not.toHaveBeenCalled();
  });

  it('uses the in-memory cache to avoid repeated Twilio reads', async () => {
    hoisted.incomingList.mockResolvedValueOnce([
      {
        sid: 'PN_shared',
        smsUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
        smsMethod: 'POST',
      },
    ]);

    const first = await ensureSharedPlatformSmsWebhookConfigured('https://www.clientific.app', {
      minIntervalMs: 60_000,
    });
    const second = await ensureSharedPlatformSmsWebhookConfigured('https://www.clientific.app', {
      minIntervalMs: 60_000,
    });

    expect(first.status).toBe('unchanged');
    expect(second.status).toBe('cached');
    expect(hoisted.incomingList).toHaveBeenCalledTimes(1);
  });
});
