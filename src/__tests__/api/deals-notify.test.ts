import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    deal: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/deal-claims', () => ({
  claimDealForCustomer: vi.fn(),
  DealClaimError: class DealClaimError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = 'DealClaimError';
      this.status = status;
    }
  },
}));

vi.mock('@/lib/twilio', () => ({
  sendSMS: vi.fn().mockResolvedValue({ success: true }),
  formatPhoneNumber: vi.fn((phone: string) => phone),
  formatDealClaimCodeSMS: vi.fn(
    (details: {
      businessName: string;
      dealTitle: string;
      dealCode: string;
      customerName?: string | null;
      bookingUrl?: string | null;
    }) =>
      `Hi ${details.customerName ?? 'there'}, your ${details.businessName} ${details.dealTitle} code is ${details.dealCode}.`
  ),
}));

vi.mock('@/lib/brand', () => ({
  APP_URL: 'https://clientific.app',
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { claimDealForCustomer, DealClaimError } from '@/lib/deal-claims';
import { formatDealClaimCodeSMS, sendSMS } from '@/lib/twilio';
import { POST } from '@/app/api/deals/[id]/notify/route';

const SESSION = { user: { id: 'biz-1' } };
const DEAL = {
  id: 'deal-1',
  businessId: 'biz-1',
  title: 'Test Deal',
  active: true,
  notifiedAt: null,
  business: {
    name: 'Test Salon',
    slug: 'test-salon',
    enableOnlineBooking: true,
    vapiPhoneNumber: '+15557654989',
  },
};

function notifyReq(id = 'deal-1') {
  return new NextRequest(`http://localhost/api/deals/${id}/notify`, { method: 'POST' });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/deals/[id]/notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(DEAL as any);
    vi.mocked(prisma.deal.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
    vi.mocked(claimDealForCustomer).mockResolvedValue({
      code: 'ABCD1234',
      created: true,
      customerId: 'cust-1',
      deal: {
        id: 'deal-1',
        businessId: 'biz-1',
        title: 'Test Deal',
        startsAt: new Date('2026-03-01T00:00:00.000Z'),
        expiresAt: new Date('2026-03-31T00:00:00.000Z'),
        active: true,
        maxRedemptions: null,
        redemptionCount: 0,
      },
      expiresAt: new Date('2026-03-31T00:00:00.000Z'),
    } as any);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(notifyReq(), ctx('deal-1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown deal', async () => {
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(null);
    const res = await POST(notifyReq('nonexistent'), ctx('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 403 for a deal belonging to a different business', async () => {
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ ...DEAL, businessId: 'other-biz' } as any);
    const res = await POST(notifyReq(), ctx('deal-1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 for an inactive deal', async () => {
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ ...DEAL, active: false } as any);
    const res = await POST(notifyReq(), ctx('deal-1'));
    expect(res.status).toBe(400);
  });

  it('returns 429 when the deal is still on cooldown', async () => {
    const recentlyNotified = new Date(Date.now() - 1 * 86400000).toISOString();
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ ...DEAL, notifiedAt: recentlyNotified } as any);

    const res = await POST(notifyReq(), ctx('deal-1'));

    expect(res.status).toBe(429);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
    expect(claimDealForCustomer).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('issues personalized codes and texts eligible customers', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { id: 'cust-1', phone: '5551111111', name: 'Jane Doe' },
      { id: 'cust-2', phone: '5552222222', name: 'Alex' },
    ] as any);
    vi.mocked(claimDealForCustomer)
      .mockResolvedValueOnce({ code: 'JANE1234' } as any)
      .mockResolvedValueOnce({ code: 'ALEX5678' } as any);

    const res = await POST(notifyReq(), ctx('deal-1'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(body.skipped).toBe(0);
    expect(claimDealForCustomer).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        dealId: 'deal-1',
        businessId: 'biz-1',
        customerId: 'cust-1',
        customerPhone: '5551111111',
        customerName: 'Jane Doe',
      })
    );
    expect(formatDealClaimCodeSMS).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        businessName: 'Test Salon',
        dealTitle: 'Test Deal',
        dealCode: 'JANE1234',
        customerName: 'Jane Doe',
        bookingUrl: 'https://clientific.app/book/test-salon',
      })
    );
    expect(sendSMS).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: '5551111111',
        from: '+15557654989',
      })
    );
  });

  it('counts only successful SMS sends', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { id: 'cust-1', phone: '5551111111', name: 'Jane Doe' },
      { id: 'cust-2', phone: '5552222222', name: 'Alex' },
    ] as any);
    vi.mocked(sendSMS)
      .mockResolvedValueOnce({ success: true } as any)
      .mockResolvedValueOnce({ success: false, error: 'carrier reject' } as any);

    const res = await POST(notifyReq(), ctx('deal-1'));
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(body.skipped).toBe(0);
  });

  it('returns sent 0 when no eligible customers exist', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);

    const res = await POST(notifyReq(), ctx('deal-1'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.skipped).toBe(0);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('updates notifiedAt on the deal before sending', async () => {
    await POST(notifyReq(), ctx('deal-1'));

    expect(prisma.deal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'deal-1' }),
        data: expect.objectContaining({ notifiedAt: expect.any(Date) }),
      })
    );
  });

  it('deduplicates matching phone numbers so only one code is issued and one text is sent', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { id: 'cust-1', phone: '5551111111', name: 'Jane Doe' },
      { id: 'cust-2', phone: '5551111111', name: 'Jane Duplicate' },
    ] as any);

    const res = await POST(notifyReq(), ctx('deal-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(claimDealForCustomer).toHaveBeenCalledTimes(1);
    expect(sendSMS).toHaveBeenCalledTimes(1);
  });

  it('does not send texts if another request already reserved the notify send', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ id: 'cust-1', phone: '5551111111', name: 'Jane Doe' }] as any);
    vi.mocked(prisma.deal.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await POST(notifyReq(), ctx('deal-1'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already being sent/i);
    expect(claimDealForCustomer).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('queries only sms-marketing-consented customers with a phone', async () => {
    await POST(notifyReq(), ctx('deal-1'));

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          smsMarketingConsent: true,
          smsOptedOut: false,
          phone: { not: null },
        }),
      })
    );
  });

  it('scopes recipients to session.user.businessId when session.user.id differs', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1', businessId: 'biz-1' } } as any);
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ id: 'cust-1', phone: '5551111111', name: 'Jane Doe' }] as any);

    const res = await POST(notifyReq(), ctx('deal-1'));

    expect(res.status).toBe(200);
    expect(requireActiveSubscription).toHaveBeenCalledWith('biz-1');
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
        }),
      })
    );
  });

  it('skips recipients that cannot be issued a valid code without failing the whole batch', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { id: 'cust-1', phone: '5551111111', name: 'Jane Doe' },
      { id: 'cust-2', phone: '5552222222', name: 'Alex' },
    ] as any);
    vi.mocked(claimDealForCustomer)
      .mockRejectedValueOnce(new DealClaimError('Deal has reached maximum redemptions', 400))
      .mockResolvedValueOnce({ code: 'ALEX5678' } as any);

    const res = await POST(notifyReq(), ctx('deal-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(body.skipped).toBe(1);
    expect(sendSMS).toHaveBeenCalledTimes(1);
  });
});
