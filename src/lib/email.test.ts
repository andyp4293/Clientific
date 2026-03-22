import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSend, mockResendCtor } = vi.hoisted(() => {
  const send = vi.fn().mockResolvedValue({});
  const ctor = vi.fn().mockImplementation(() => ({
    emails: {
      send,
    },
  }));
  return { mockSend: send, mockResendCtor: ctor };
});

vi.mock('resend', () => ({
  Resend: mockResendCtor,
}));

import { sendEmailVerificationEmail, sendSupportContactEmail } from './email';

describe('email sender configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'noreply@clientific.app';
    process.env.NEXT_PUBLIC_APP_URL = 'https://clientific.app';
  });

  it('trims RESEND_FROM_EMAIL before sending verification email', async () => {
    process.env.RESEND_FROM_EMAIL = 'noreply@clientific.app\n';

    await sendEmailVerificationEmail('owner@example.com', '123456');

    expect(mockResendCtor).toHaveBeenCalledWith('re_test_key');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Clientific <noreply@clientific.app>',
        to: 'owner@example.com',
        subject: expect.stringContaining('verification code'),
        text: expect.stringContaining('Your verification code is: 123456'),
        html: expect.stringContaining('123456'),
      })
    );
  });

  it('trims RESEND_API_KEY before passing to Resend constructor', async () => {
    // Simulates the Vercel paste-artifact: key stored with trailing \n.
    // Without .trim() the Resend client would authenticate with the wrong key.
    process.env.RESEND_API_KEY = 're_test_key\n';

    await sendEmailVerificationEmail('owner@example.com', '123456');

    expect(mockResendCtor).toHaveBeenCalledWith('re_test_key');
  });

  it('sends support contact email to the canonical support inbox with reply-to set', async () => {
    await sendSupportContactEmail({
      name: 'Jane Doe',
      email: 'owner@example.com',
      company: 'Test Salon',
      subject: 'Billing question',
      message: 'Need help with an invoice.',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Clientific <noreply@clientific.app>',
        to: 'support@clientific.app',
        replyTo: 'owner@example.com',
        subject: 'Support request: Billing question',
        text: expect.stringContaining('Need help with an invoice.'),
        html: expect.stringContaining('Need help with an invoice.'),
      })
    );
  });
});
