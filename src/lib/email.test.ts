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

import {
  sendEmailVerificationEmail,
  sendStaffTemporaryPasswordEmail,
  sendSupportContactEmail,
} from './email';

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

  it('sends staff temporary password instructions with clear setup and privacy steps', async () => {
    await sendStaffTemporaryPasswordEmail({
      to: 'taylor@example.com',
      staffName: 'Taylor Nguyen',
      businessName: 'Clientific Studio',
      temporaryPassword: 'TempPass123!',
      loginUrl: 'https://clientific.app/login',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'taylor@example.com',
        subject: 'Clientific Studio invited you to Clientific',
        text: expect.stringContaining('What to do next:'),
        html: expect.stringContaining('What to do next'),
      }),
    );
    const sent = mockSend.mock.calls.at(-1)?.[0];
    expect(sent.text).toContain(
      'Use the sign-in email and temporary password exactly as shown above.',
    );
    expect(sent.text).toContain(
      'After setup, you will see only the appointments assigned to you.',
    );
    expect(sent.text).toContain(
      'employee accounts cannot see customer phone numbers, CRM lists, deals, billing, or business settings',
    );
    expect(sent.html).toContain('Create your own password when prompted');
    expect(sent.html).toContain('only appointments assigned to you');
  });
});
