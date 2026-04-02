import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const createMessage = vi.fn();
  const ensureSharedPlatformSmsWebhookConfigured = vi.fn();
  const twilioFactory = vi.fn(() => ({
    messages: {
      create: createMessage,
    },
  }));
  return { createMessage, ensureSharedPlatformSmsWebhookConfigured, twilioFactory };
});

vi.mock('twilio', () => ({
  default: hoisted.twilioFactory,
}));

vi.mock('@/lib/twilio-routing', () => ({
  ensureSharedPlatformSmsWebhookConfigured: hoisted.ensureSharedPlatformSmsWebhookConfigured,
}));

import { sendSMS } from './twilio';

const ORIGINAL_ENV = { ...process.env };

describe('sendSMS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & {
      __clientificSharedPlatformSmsWebhookCache?: unknown;
    }).__clientificSharedPlatformSmsWebhookCache;
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_PHONE_NUMBER = '+18557654989';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG_should_not_be_used';
    hoisted.ensureSharedPlatformSmsWebhookConfigured.mockResolvedValue({
      status: 'unchanged',
      phoneNumber: '+18557654989',
      smsWebhookUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('forces direct from phone number even when messaging service sid is present', async () => {
    hoisted.createMessage.mockResolvedValueOnce({ sid: 'SM123' });

    const result = await sendSMS({ to: '5551234567', message: 'Test message' });

    expect(result.success).toBe(true);
    expect(hoisted.createMessage).toHaveBeenCalledTimes(1);
    const payload = hoisted.createMessage.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        body: 'Test message',
        from: '+18557654989',
        to: '+15551234567',
      })
    );
    expect(payload.messagingServiceSid).toBeUndefined();
  });

  it('returns failure when twilio credentials are missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;

    const result = await sendSMS({ to: '+15551234567', message: 'Test message' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Twilio not configured');
    expect(hoisted.createMessage).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid phone number', async () => {
    const result = await sendSMS({ to: 'abc', message: 'Test message' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid phone number');
    expect(hoisted.createMessage).not.toHaveBeenCalled();
  });

  it('surfaces twilio send failures', async () => {
    hoisted.createMessage.mockRejectedValueOnce(new Error('carrier reject'));

    const result = await sendSMS({ to: '+15551234567', message: 'Test message' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('carrier reject');
  });

  it('trims TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN before authenticating', async () => {
    // Simulates the Vercel paste-artifact: credentials stored with trailing \n.
    // Without .trim() the Twilio factory would receive the dirty values.
    process.env.TWILIO_ACCOUNT_SID = 'AC_test\n';
    process.env.TWILIO_AUTH_TOKEN = 'token_test\n';
    hoisted.createMessage.mockResolvedValueOnce({ sid: 'SM_trim_test' });

    await sendSMS({ to: '+15551234567', message: 'Test message' });

    expect(hoisted.twilioFactory).toHaveBeenCalledWith('AC_test', 'token_test');
  });

  it('always uses the platform sender number regardless of from param', async () => {
    hoisted.createMessage.mockResolvedValueOnce({ sid: 'SM456' });

    const result = await sendSMS({
      to: '+15551234567',
      message: 'Test message',
      from: '+17755146208', // ignored — platform number is always used
    });

    expect(result.success).toBe(true);
    expect(hoisted.createMessage).toHaveBeenCalledTimes(1);
    expect(hoisted.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '+18557654989',
        to: '+15551234567',
      })
    );
  });

  it('verifies the shared inbound sms webhook before sending', async () => {
    hoisted.createMessage.mockResolvedValueOnce({ sid: 'SM_repair_test' });

    const result = await sendSMS({ to: '+15551234567', message: 'Test message' });

    expect(result.success).toBe(true);
    expect(hoisted.ensureSharedPlatformSmsWebhookConfigured).toHaveBeenCalledTimes(1);
    expect(hoisted.ensureSharedPlatformSmsWebhookConfigured).toHaveBeenCalledWith(
      expect.stringMatching(/^https?:\/\//)
    );
  });
});
