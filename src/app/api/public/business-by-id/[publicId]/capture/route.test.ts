import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    smsConsentEvent: { create: vi.fn() },
  },
}));

vi.mock('@/lib/twilio', () => ({
  formatKioskDealClaimSMS: vi.fn(() => 'deal sms'),
  formatKioskSignupConfirmationSMS: vi.fn(() => 'signup sms'),
  formatPhoneNumber: vi.fn((phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
  }),
  isValidPhoneNumber: vi.fn(() => true),
  sendSMS: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/in-store-capture', () => ({
  getInStoreCaptureConfig: vi.fn(),
}));

vi.mock('@/lib/deal-claims', () => ({
  claimDealForCustomer: vi.fn(),
  DealClaimError: class DealClaimError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { prisma } from '@/lib/prisma';
import {
  formatKioskDealClaimSMS,
  formatKioskSignupConfirmationSMS,
  sendSMS,
} from '@/lib/twilio';
import { getInStoreCaptureConfig } from '@/lib/in-store-capture';
import { claimDealForCustomer, DealClaimError } from '@/lib/deal-claims';
import { GET, POST } from './route';

function makeParams(publicId = 'pub_123') {
  return { params: Promise.resolve({ publicId }) };
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/public/business-by-id/pub_123/capture', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.8',
      'user-agent': 'Vitest Browser',
    },
    body: JSON.stringify(body),
  });
}

describe('Public in-store capture route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      name: 'Test Salon',
      slug: 'test-salon',
      enableOnlineBooking: true,
      vapiPhoneNumber: '+18557654989',
    } as any);

    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customer.create).mockResolvedValue({
      id: 'cust-1',
      name: 'Jane',
      phone: '+15551234567',
      email: 'jane@example.com',
    } as any);
    vi.mocked(prisma.customer.update).mockResolvedValue({
      id: 'cust-1',
      name: 'Jane',
      phone: '+15551234567',
      email: 'jane@example.com',
    } as any);
    vi.mocked(prisma.smsConsentEvent.create).mockResolvedValue({ id: 'evt-1' } as any);

    vi.mocked(getInStoreCaptureConfig).mockResolvedValue({
      business: {
        name: 'Test Salon',
        publicId: 'pub_123',
        slug: 'test-salon',
        logoUrl: null,
        publicProfileHeadline: 'Walk in and join the list',
        bookingEnabled: true,
      },
      deal: {
        id: 'deal-1',
        title: 'Spring Special',
        description: null,
        discountLabel: '20% off',
        expiresAt: '2026-03-20T00:00:00.000Z',
        serviceName: 'Gel manicure',
      },
      captureUrl: 'https://clientific.app/capture/pub_123?deal=deal-1',
      bookingUrl: 'https://clientific.app/book/test-salon',
    });

    vi.mocked(claimDealForCustomer).mockResolvedValue({
      code: 'ABCD1234',
      created: true,
      customerId: 'cust-1',
      deal: {
        id: 'deal-1',
        businessId: 'biz-1',
        title: 'Spring Special',
        startsAt: new Date('2026-03-10T00:00:00.000Z'),
        expiresAt: new Date('2026-03-20T00:00:00.000Z'),
        active: true,
        maxRedemptions: null,
        redemptionCount: 0,
      },
      expiresAt: new Date('2026-03-20T00:00:00.000Z'),
    } as any);
  });

  it('returns capture config for the public kiosk page', async () => {
    const req = new NextRequest('http://localhost/api/public/business-by-id/pub_123/capture?deal=deal-1');
    const res = await GET(req, makeParams());

    expect(res.status).toBe(200);
    expect(getInStoreCaptureConfig).toHaveBeenCalledWith({
      publicId: 'pub_123',
      dealId: 'deal-1',
      requestUrl: 'http://localhost/api/public/business-by-id/pub_123/capture?deal=deal-1',
    });

    const body = await res.json();
    expect(body.deal.title).toBe('Spring Special');
    expect(body.captureUrl).toContain('/capture/pub_123?deal=deal-1');
  });

  it('creates a new opted-in customer, claims the selected deal, and sends a confirmation text', async () => {
    const res = await POST(
      makePostRequest({
        name: 'Jane',
        phone: '5551234567',
        email: 'jane@example.com',
        smsMarketingConsent: true,
        dealId: 'deal-1',
      }),
      makeParams()
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          name: 'Jane',
          phone: '+15551234567',
          smsConsent: true,
          smsMarketingConsent: true,
          smsOptedOut: false,
        }),
      })
    );
    expect(claimDealForCustomer).toHaveBeenCalledWith({
      dealId: 'deal-1',
      businessId: 'biz-1',
      customerId: 'cust-1',
    });
    expect(formatKioskDealClaimSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Test Salon',
        dealTitle: 'Spring Special',
        dealCode: 'ABCD1234',
      })
    );
    expect(sendSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+15551234567',
        from: '+18557654989',
        message: 'deal sms',
      })
    );
    expect(prisma.smsConsentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'KIOSK_OPT_IN',
          source: 'in_store_capture',
          ipAddress: '203.0.113.8',
          userAgent: 'Vitest Browser',
          metadata: expect.objectContaining({
            dealId: 'deal-1',
            dealClaimed: true,
            reOptIn: false,
            channel: 'device_capture',
          }),
        }),
      })
    );

    const body = await res.json();
    expect(body.deal.code).toBe('ABCD1234');
    expect(body.confirmationSent).toBe(true);
  });

  it('re-enables an opted-out customer and falls back to generic signup if the selected deal is unavailable', async () => {
    vi.mocked(prisma.customer.findFirst).mockResolvedValue({
      id: 'cust-1',
      name: 'Jane',
      phone: '+15551234567',
      email: null,
      smsOptedOut: true,
    } as any);
    vi.mocked(claimDealForCustomer).mockRejectedValue(
      new DealClaimError('Deal is not currently active', 400)
    );

    const res = await POST(
      makePostRequest({
        name: 'Jane',
        phone: '5551234567',
        smsMarketingConsent: true,
        dealId: 'deal-1',
      }),
      makeParams()
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-1' },
        data: expect.objectContaining({
          smsConsent: true,
          smsMarketingConsent: true,
          smsOptedOut: false,
          smsOptedOutAt: null,
        }),
      })
    );
    expect(formatKioskSignupConfirmationSMS).toHaveBeenCalledTimes(1);
    expect(sendSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'signup sms',
      })
    );

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deal).toBeNull();
    expect(body.dealIssue).toContain('not currently active');
    expect(prisma.smsConsentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            reOptIn: true,
            dealClaimed: false,
            dealIssue: 'Deal is not currently active',
            channel: 'device_capture',
          }),
        }),
      })
    );
  });

  it('rejects submissions without SMS consent', async () => {
    const res = await POST(
      makePostRequest({
        name: 'Jane',
        phone: '5551234567',
        smsMarketingConsent: false,
      }),
      makeParams()
    );

    expect(res.status).toBe(400);
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });
});
