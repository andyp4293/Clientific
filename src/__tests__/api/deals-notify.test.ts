/**
 * Tests for POST /api/deals/[id]/notify
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    deal: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
  formatDealNotificationSMS: vi.fn((details: { businessName: string; dealTitle: string; dealUrl: string }) =>
    `${details.businessName}: ${details.dealTitle} is now available. Claim this offer here: ${details.dealUrl} Reply STOP to opt out, HELP for help.`
  ),
}));

vi.mock('@/lib/brand', () => ({
  APP_URL: 'https://clientific.app',
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { formatDealNotificationSMS, sendSMS } from '@/lib/twilio';
import { POST } from '@/app/api/deals/[id]/notify/route';

const SESSION = { user: { id: 'biz-1' } };
const DEAL = {
  id: 'deal-1',
  businessId: 'biz-1',
  title: 'Test Deal',
  active: true,
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
    vi.mocked(prisma.deal.update).mockResolvedValue({} as any);
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

  it('sends SMS to eligible customers and returns count', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { phone: '5551111111' },
      { phone: '5552222222' },
    ] as any);

    const res = await POST(notifyReq(), ctx('deal-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(sendSMS).toHaveBeenCalledTimes(2);
  });

  it('counts only successful sendSMS results', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { phone: '5551111111' },
      { phone: '5552222222' },
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
    expect(prisma.deal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'deal-1' },
        data: expect.objectContaining({ notifiedAt: expect.any(Date) }),
      })
    );
  });

  it('queries only smsMarketingConsent=true, smsOptedOut=false customers with a phone', async () => {
    await POST(notifyReq(), ctx('deal-1'));
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          smsMarketingConsent: true,
          smsOptedOut: false,
          phone: { not: null },
        }),
      })
    );
  });

  it('sends dedicated deal landing page URL', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ phone: '5551111111' }] as any);
    await POST(notifyReq(), ctx('deal-1'));
    expect(formatDealNotificationSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Test Salon',
        dealTitle: 'Test Deal',
        dealUrl: 'https://clientific.app/d/deal-1',
      })
    );
    expect(sendSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('https://clientific.app/d/deal-1'),
      })
    );
  });

  it('sends polished deal copy without dash separators', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ phone: '5551111111' }] as any);
    await POST(notifyReq(), ctx('deal-1'));

    const call = vi.mocked(sendSMS).mock.calls[0]?.[0];
    expect(call?.message).toContain('Claim this offer here:');
    expect(call?.message).not.toContain('--');
  });
});
