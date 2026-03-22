import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/email', () => ({
  sendSupportContactEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendSupportContactEmail } from '@/lib/email';
import { POST } from './route';

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/support/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/support/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(req({ name: 'Jane' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/required/i);
  });

  it('returns 400 for invalid email addresses', async () => {
    const res = await POST(
      req({
        name: 'Jane Doe',
        email: 'bad-email',
        message: 'I need help with billing.',
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid email/i);
  });

  it('silently succeeds for honeypot submissions without sending email', async () => {
    const res = await POST(
      req({
        name: 'Jane Doe',
        email: 'jane@example.com',
        message: 'Real looking spam',
        website: 'https://spam.example.com',
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(sendSupportContactEmail).not.toHaveBeenCalled();
  });

  it('blocks disallowed content in public support messages', async () => {
    const res = await POST(
      req({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Billing',
        message: 'This is fucking broken.',
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/disallowed content/i);
    expect(sendSupportContactEmail).not.toHaveBeenCalled();
  });

  it('sends support emails with normalized fields for valid submissions', async () => {
    const res = await POST(
      req({
        name: '  Jane Doe  ',
        email: '  JANE@EXAMPLE.COM  ',
        company: '  Test Salon  ',
        subject: '  Billing question  ',
        message: '  I need help understanding my invoice.  ',
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(sendSupportContactEmail).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      company: 'Test Salon',
      subject: 'Billing question',
      message: 'I need help understanding my invoice.',
    });
  });

  it('returns 500 when email delivery fails', async () => {
    vi.mocked(sendSupportContactEmail).mockRejectedValueOnce(new Error('email down'));

    const res = await POST(
      req({
        name: 'Jane Doe',
        email: 'jane@example.com',
        message: 'Please help.',
      })
    );

    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/support@clientific\.app/i);
  });
});
