/**
 * Tests for POST /api/deals/[id]/notify
 */
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

vi.mock('@/lib/twilio', () => ({
  sendSMS: vi.fn().mockResolvedValue({ success: true }),
  formatPhoneNumber: vi.fn((p: string) => p),
  formatDealNotificationSMS: vi.fn((details: { businessName: string; dealTitle: string; dealUrl: string; customerName?: string | null }) =>
    `Hi ${details.customerName ?? 'there'}, ${details.businessName} has a special offer for you: ${details.dealTitle}. Book your appointment here: ${details.dealUrl} Reply STOP to opt out, HELP for help.`
  ),
}));

vi.mock('@/lib/brand', () => ({
  APP_URL: 'https://clientific.app',
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { formatDealNotificationSMS, sendSMS } from '@/lib/twilio';
import { POST } from '@/app/api/deals/[id]/notify/route';

const SESSION = { user: { id: 'biz-1' } };
const DEAL = {
  id: 'deal-1',
  businessId: 'biz-1',
  title: 'Test Deal',
  active: true,
  notifiedAt: null,
  business: { name: 'Test Salon', slug: 'test-salon' },
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

  it('returns 403 for deal belonging to different business', async () => {
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ ...DEAL, businessId: 'other-biz' } as any);
    const res = await POST(notifyReq(), ctx('deal-1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 for inactive deal', async () => {
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ ...DEAL, active: false } as any);
    const res = await POST(notifyReq(), ctx('deal-1'));
    expect(res.status).toBe(400);
  });

  it('returns 429 when the deal was notified within the last 3 days', async () => {
    const recentlyNotified = new Date(Date.now() - 1 * 86400000).toISOString();
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ ...DEAL, notifiedAt: recentlyNotified } as any);

    const res = await POST(notifyReq(), ctx('deal-1'));

    expect(res.status).toBe(429);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('sends SMS to eligible customers and returns count', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { phone: '5551111111', name: 'Jane Doe' },
      { phone: '5552222222', name: 'Alex' },
    ] as any);

    const res = await POST(notifyReq(), ctx('deal-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(sendSMS).toHaveBeenCalledTimes(2);
  });

  it('counts only successful sendSMS results', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { phone: '5551111111', name: 'Jane Doe' },
      { phone: '5552222222', name: 'Alex' },
    ] as any);
    vi.mocked(sendSMS)
      .mockResolvedValueOnce({ success: true } as any)
      .mockResolvedValueOnce({ success: false, error: 'carrier reject' } as any);

    const res = await POST(notifyReq(), ctx('deal-1'));
    const body = await res.json();
    expect(body.sent).toBe(1);
  });

  it('sends 0 when no eligible customers', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
    const res = await POST(notifyReq(), ctx('deal-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('updates notifiedAt on the deal', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
    await POST(notifyReq(), ctx('deal-1'));
    expect(prisma.deal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'deal-1' }),
        data: expect.objectContaining({ notifiedAt: expect.any(Date) }),
      })
    );
  });

  it('deduplicates customers with the same phone number so only one text is sent', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { phone: '5551111111', name: 'Jane Doe' },
      { phone: '5551111111', name: 'Jane Duplicate' },
    ] as any);

    const res = await POST(notifyReq(), ctx('deal-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(sendSMS).toHaveBeenCalledTimes(1);
  });

  it('does not send texts if another request already reserved the notify send', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ phone: '5551111111', name: 'Jane Doe' }] as any);
    vi.mocked(prisma.deal.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await POST(notifyReq(), ctx('deal-1'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already being sent/i);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('queries only smsMarketingConsent=true, smsOptedOut=false customers with a phone', async () => {
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

  it('scopes recipients to the authenticated businessId when session.user.id differs', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1', businessId: 'biz-1' } } as any);
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ phone: '5551111111', name: 'Jane Doe' }] as any);

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
    expect(sendSMS).toHaveBeenCalledTimes(1);
  });

  it('sends dedicated deal landing page URL', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ phone: '5551111111', name: 'Jane Doe' }] as any);
    await POST(notifyReq(), ctx('deal-1'));
    expect(formatDealNotificationSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Test Salon',
        dealTitle: 'Test Deal',
        dealUrl: 'https://clientific.app/d/deal-1',
        customerName: 'Jane Doe',
      })
    );
    expect(sendSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('https://clientific.app/d/deal-1'),
      })
    );
  });

  it('sends polished deal copy without dash separators', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ phone: '5551111111', name: 'Jane Doe' }] as any);
    await POST(notifyReq(), ctx('deal-1'));

    const call = vi.mocked(sendSMS).mock.calls[0]?.[0];
    expect(call?.message).toContain('Book your appointment here:');
    expect(call?.message).not.toContain('--');
  });

  it('passes customer name to formatter for per-recipient personalization', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { phone: '5551111111', name: 'Jane Doe' },
      { phone: '5552222222', name: null },
    ] as any);

    await POST(notifyReq(), ctx('deal-1'));

    expect(formatDealNotificationSMS).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ customerName: 'Jane Doe' })
    );
    expect(formatDealNotificationSMS).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ customerName: null })
    );
  });
});
