import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    deal: { findUnique: vi.fn(), update: vi.fn() },
    dealRedemption: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/twilio', () => ({
  sendSMS: vi.fn().mockResolvedValue({ success: true }),
  formatPhoneNumber: vi.fn((phone: string) => `+1${phone.replace(/\D/g, '')}`),
  formatDealClaimCodeSMS: vi.fn(() => 'deal claim sms'),
}));

import { prisma } from '@/lib/prisma';
import { formatDealClaimCodeSMS, sendSMS } from '@/lib/twilio';
import { POST } from './route';

const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockDealFindUnique = prisma.deal.findUnique as ReturnType<typeof vi.fn>;
const mockRedemptionFindUnique = prisma.dealRedemption.findUnique as ReturnType<typeof vi.fn>;
const mockRedemptionFindFirst = prisma.dealRedemption.findFirst as ReturnType<typeof vi.fn>;
const mockCustomerFindFirst = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockCustomerCreate = prisma.customer.create as ReturnType<typeof vi.fn>;
const mockCustomerUpdate = prisma.customer.update as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const mockSendSMS = sendSMS as ReturnType<typeof vi.fn>;
const mockFormatDealClaimCodeSMS = formatDealClaimCodeSMS as ReturnType<typeof vi.fn>;

const now = new Date();
const activeDeal = {
  id: 'deal-1',
  businessId: 'biz-1',
  title: 'Spring Special',
  active: true,
  startsAt: new Date(now.getTime() - 86400000),
  expiresAt: new Date(now.getTime() + 86400000 * 7),
  maxRedemptions: null,
  redemptionCount: 0,
};

function makeRequest(
  dealId: string,
  body: Record<string, unknown> = {
    customerName: 'Jane Doe',
    customerPhone: '5551234567',
  }
) {
  return new NextRequest(`http://localhost/api/public/deals/${dealId}/claim`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRedemptionFindUnique.mockResolvedValue(null);
  mockRedemptionFindFirst.mockResolvedValue(null);
  mockBusinessFindUnique.mockResolvedValue({
    name: 'Test Salon',
    slug: 'test-salon',
    enableOnlineBooking: true,
    vapiPhoneNumber: '+15557654989',
  });
  mockSendSMS.mockResolvedValue({ success: true });
  mockFormatDealClaimCodeSMS.mockReturnValue('deal claim sms');
});

describe('POST /api/public/deals/[id]/claim', () => {
  it('returns 400 when customer name or phone is missing', async () => {
    const res = await POST(makeRequest('deal-1', { customerPhone: '5551234567' }), makeParams('deal-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('customerName and customerPhone are required');
  });

  it('returns 404 when deal does not exist', async () => {
    mockDealFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when deal is inactive', async () => {
    mockDealFindUnique.mockResolvedValue({ ...activeDeal, active: false });
    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when deal has not started yet', async () => {
    mockDealFindUnique.mockResolvedValue({
      ...activeDeal,
      startsAt: new Date(now.getTime() + 86400000),
    });
    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not currently active');
  });

  it('returns 400 when deal has expired', async () => {
    mockDealFindUnique.mockResolvedValue({
      ...activeDeal,
      expiresAt: new Date(now.getTime() - 1000),
    });
    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not currently active');
  });

  it('returns 400 when max redemptions reached for a new claimant', async () => {
    mockDealFindUnique.mockResolvedValue({
      ...activeDeal,
      maxRedemptions: 10,
      redemptionCount: 10,
    });
    mockCustomerFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('maximum redemptions');
  });

  it('creates a customer and redemption code for an active public claim', async () => {
    mockDealFindUnique.mockResolvedValue(activeDeal);
    mockCustomerFindFirst.mockResolvedValue(null);
    mockCustomerCreate.mockResolvedValue({ id: 'cust-1' });
    const fakeRedemption = { code: 'ABCD1234', dealId: 'deal-1', customerId: 'cust-1' };
    mockTransaction.mockResolvedValue([fakeRedemption, { id: 'deal-1' }]);

    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('ABCD1234');
    expect(body.expiresAt).toBeDefined();
    expect(body.confirmationSent).toBe(true);
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          name: 'Jane Doe',
          phone: '+15551234567',
          smsConsent: true,
          smsMarketingConsent: false,
        }),
      })
    );
    expect(mockFormatDealClaimCodeSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Test Salon',
        dealTitle: 'Spring Special',
        dealCode: 'ABCD1234',
        customerName: 'Jane Doe',
        bookingUrl: expect.stringMatching(/\/book\/test-salon$/),
      })
    );
    expect(mockSendSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+15551234567',
        from: '+15557654989',
        message: 'deal claim sms',
      })
    );
  });

  it('updates the matched customer name before issuing a code', async () => {
    mockDealFindUnique.mockResolvedValue(activeDeal);
    mockCustomerFindFirst.mockResolvedValue({ id: 'cust-1', name: 'Old Name' });
    mockCustomerUpdate.mockResolvedValue({ id: 'cust-1', name: 'Jane Doe' });
    const fakeRedemption = { code: 'WXYZ5678', dealId: 'deal-1', customerId: 'cust-1' };
    mockTransaction.mockResolvedValue([fakeRedemption, { id: 'deal-1' }]);

    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));

    expect(res.status).toBe(200);
    expect(mockCustomerUpdate).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: {
        name: 'Jane Doe',
        smsConsent: true,
      },
    });
  });

  it('reuses an existing code for the same customer even after the cap is reached', async () => {
    mockDealFindUnique.mockResolvedValue({
      ...activeDeal,
      maxRedemptions: 10,
      redemptionCount: 10,
    });
    mockCustomerFindFirst.mockResolvedValue({ id: 'cust-1', name: 'Jane Doe' });
    mockRedemptionFindFirst.mockResolvedValue({ code: 'EXIST123' });

    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('EXIST123');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('still returns the code when sms delivery fails', async () => {
    mockDealFindUnique.mockResolvedValue(activeDeal);
    mockCustomerFindFirst.mockResolvedValue({ id: 'cust-1', name: 'Jane Doe' });
    const fakeRedemption = { code: 'ABCD1234', dealId: 'deal-1', customerId: 'cust-1' };
    mockTransaction.mockResolvedValue([fakeRedemption, { id: 'deal-1' }]);
    mockSendSMS.mockResolvedValue({ success: false, error: 'carrier reject' });

    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe('ABCD1234');
    expect(body.confirmationSent).toBe(false);
  });
});
