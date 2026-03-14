import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    deal: { findUnique: vi.fn(), update: vi.fn() },
    dealRedemption: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    customer: { findFirst: vi.fn() },
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
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const mockSendSMS = sendSMS as ReturnType<typeof vi.fn>;
const mockFormatDealClaimCodeSMS = formatDealClaimCodeSMS as ReturnType<typeof vi.fn>;

const now = new Date();
const activeDeal = {
  id: 'deal-1',
  businessId: 'biz-1',
  title: 'Spring Special',
  active: true,
  startsAt: new Date(now.getTime() - 86400000), // yesterday
  expiresAt: new Date(now.getTime() + 86400000 * 7), // 7 days from now
  maxRedemptions: null,
  redemptionCount: 0,
};

function makeRequest(dealId: string, body: Record<string, unknown> = { customerPhone: '5551234567' }) {
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
  mockRedemptionFindUnique.mockResolvedValue(null); // no code collision
  mockRedemptionFindFirst.mockResolvedValue(null); // no previous claim
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
  it('returns 400 when customerPhone is missing', async () => {
    const res = await POST(makeRequest('deal-1', {}), makeParams('deal-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('customerPhone is required');
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
      startsAt: new Date(now.getTime() + 86400000), // tomorrow
    });
    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not currently active');
  });

  it('returns 400 when deal has expired', async () => {
    mockDealFindUnique.mockResolvedValue({
      ...activeDeal,
      expiresAt: new Date(now.getTime() - 1000), // expired 1 second ago
    });
    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not currently active');
  });

  it('returns 400 when max redemptions reached', async () => {
    mockDealFindUnique.mockResolvedValue({
      ...activeDeal,
      maxRedemptions: 10,
      redemptionCount: 10,
    });
    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('maximum redemptions');
  });

  it('creates redemption code for active deal', async () => {
    mockDealFindUnique.mockResolvedValue(activeDeal);
    mockCustomerFindFirst.mockResolvedValue(null);
    const fakeRedemption = { code: 'ABCD1234', dealId: 'deal-1', customerId: null };
    mockTransaction.mockResolvedValue([fakeRedemption, { id: 'deal-1' }]);
    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('ABCD1234');
    expect(body.expiresAt).toBeDefined();
    expect(body.confirmationSent).toBe(true);
    expect(mockFormatDealClaimCodeSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Test Salon',
        dealTitle: 'Spring Special',
        dealCode: 'ABCD1234',
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

  it('links customer when customerPhone matches', async () => {
    mockDealFindUnique.mockResolvedValue(activeDeal);
    mockCustomerFindFirst.mockResolvedValue({ id: 'cust-1' });
    const fakeRedemption = { code: 'WXYZ5678', dealId: 'deal-1', customerId: 'cust-1' };
    mockTransaction.mockResolvedValue([fakeRedemption, { id: 'deal-1' }]);
    const res = await POST(makeRequest('deal-1', { customerPhone: '5551234567' }), makeParams('deal-1'));
    expect(res.status).toBe(200);
    // Verify customer lookup was called with the phone
    expect(mockCustomerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { phone: '+15551234567' },
            { phone: '5551234567' },
          ]),
        }),
      })
    );
  });

  it('reuses an existing code when the same customer already claimed the deal', async () => {
    mockDealFindUnique.mockResolvedValue(activeDeal);
    mockCustomerFindFirst.mockResolvedValue({ id: 'cust-1' });
    mockRedemptionFindFirst.mockResolvedValue({ code: 'EXIST123' });

    const res = await POST(makeRequest('deal-1', { customerPhone: '5551234567' }), makeParams('deal-1'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('EXIST123');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('allows claiming under max redemptions limit', async () => {
    mockDealFindUnique.mockResolvedValue({
      ...activeDeal,
      maxRedemptions: 10,
      redemptionCount: 5, // still has room
    });
    const fakeRedemption = { code: 'TEST1234', dealId: 'deal-1', customerId: null };
    mockTransaction.mockResolvedValue([fakeRedemption, { id: 'deal-1' }]);
    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    expect(res.status).toBe(200);
  });

  it('still returns the code when sms delivery fails', async () => {
    mockDealFindUnique.mockResolvedValue(activeDeal);
    const fakeRedemption = { code: 'ABCD1234', dealId: 'deal-1', customerId: null };
    mockTransaction.mockResolvedValue([fakeRedemption, { id: 'deal-1' }]);
    mockSendSMS.mockResolvedValue({ success: false, error: 'carrier reject' });

    const res = await POST(makeRequest('deal-1'), makeParams('deal-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe('ABCD1234');
    expect(body.confirmationSent).toBe(false);
  });
});
