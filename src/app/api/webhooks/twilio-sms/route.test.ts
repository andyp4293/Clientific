import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    smsConsentEvent: {
      createMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/webhooks/twilio-sms/route';

function inboundReq(body: Record<string, string>) {
  const payload = new URLSearchParams(body);
  return new NextRequest('http://localhost/api/webhooks/twilio-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload,
  });
}

describe('POST /api/webhooks/twilio-sms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { id: 'cust-1', businessId: 'biz-1', phone: '+15551234567' },
    ] as any);
    vi.mocked(prisma.customer.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.smsConsentEvent.createMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.smsConsentEvent.create).mockResolvedValue({ id: 'evt-1' } as any);
  });

  it('handles STOP and opts matching customers out globally', async () => {
    const res = await POST(
      inboundReq({
        From: '+1 (555) 123-4567',
        To: '+18557654989',
        Body: 'STOP',
        MessageSid: 'SM123',
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsOptedOut: true,
          smsConsent: false,
          smsMarketingConsent: false,
        }),
      })
    );
    const text = await res.text();
    expect(text).toContain('unsubscribed');
  });

  it('handles START and reenables transactional + marketing consents', async () => {
    const res = await POST(
      inboundReq({
        From: '+15551234567',
        To: '+18557654989',
        Body: 'START',
        MessageSid: 'SM124',
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsOptedOut: false,
          smsConsent: true,
          smsMarketingConsent: true,
        }),
      })
    );
    const text = await res.text();
    expect(text).toContain('resubscribed');
  });

  it('handles HELP without mutating consent flags', async () => {
    const res = await POST(
      inboundReq({
        From: '+15551234567',
        To: '+18557654989',
        Body: 'HELP',
        MessageSid: 'SM125',
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.updateMany).not.toHaveBeenCalled();
    expect(prisma.smsConsentEvent.createMany).toHaveBeenCalled();
    const text = await res.text();
    expect(text).toContain('Help');
  });

  it('treats unknown keywords as informational and does not mutate consent', async () => {
    const res = await POST(
      inboundReq({
        From: '+15551234567',
        To: '+18557654989',
        Body: 'HELLO',
        MessageSid: 'SM126',
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.updateMany).not.toHaveBeenCalled();
    expect(prisma.smsConsentEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'INBOUND_MESSAGE',
          }),
        ]),
      })
    );
    expect(res.headers.get('content-type')).toContain('text/xml');
  });

  it('handles lowercase HELP with additional text', async () => {
    const res = await POST(
      inboundReq({
        From: '+15551234567',
        To: '+18557654989',
        Body: 'help please',
        MessageSid: 'SM127',
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.updateMany).not.toHaveBeenCalled();
    const text = await res.text();
    expect(text).toContain('Help');
  });

  it('logs STOP event when no matching customers exist', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([] as any);

    const res = await POST(
      inboundReq({
        From: '+19995550123',
        To: '+18557654989',
        Body: 'STOP',
        MessageSid: 'SM128',
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.updateMany).not.toHaveBeenCalled();
    expect(prisma.smsConsentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'STOP',
          source: 'twilio_inbound',
        }),
      })
    );
  });

  it('updates all matched customers globally for shared sender numbers', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { id: 'cust-1', businessId: 'biz-1', phone: '+15551234567' },
      { id: 'cust-2', businessId: 'biz-2', phone: '5551234567' },
    ] as any);

    const res = await POST(
      inboundReq({
        From: '+1 (555) 123-4567',
        To: '+18557654989',
        Body: 'START',
        MessageSid: 'SM129',
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['cust-1', 'cust-2'] },
        }),
      })
    );
    expect(prisma.smsConsentEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ businessId: 'biz-1', eventType: 'START' }),
          expect.objectContaining({ businessId: 'biz-2', eventType: 'START' }),
        ]),
      })
    );
  });
});
