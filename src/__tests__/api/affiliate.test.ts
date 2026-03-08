/**
 * Tests for the affiliate (partner) program:
 * - POST /api/public/affiliate/register
 * - Registration with valid/invalid affiliate code
 * - Stripe webhook marking AffiliateSignup as earned
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    businessHours: { create: vi.fn() },
    referral: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    payment: { upsert: vi.fn() },
    invoice: { upsert: vi.fn() },
    notification: { create: vi.fn() },
    affiliate: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    affiliateSignup: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => {
      for (const op of ops) await op;
    }),
  },
}));

vi.mock('@/lib/utils', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
  generateSlug: vi.fn().mockReturnValue('test-biz'),
  generatePublicBusinessId: vi.fn().mockReturnValue('pub123'),
}));

vi.mock('@/lib/referral', () => ({
  generateReferralCode: vi.fn().mockResolvedValue('REFCODE1'),
}));

vi.mock('@/lib/affiliate', () => ({
  generateAffiliateCode: vi.fn().mockResolvedValue('AFFCODE1'),
}));

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    customers: { createBalanceTransaction: vi.fn().mockResolvedValue({}) },
    subscriptions: { retrieve: vi.fn() },
  },
  PRICING_PLANS: {
    STARTER: { priceId: 'price_starter', yearlyPriceId: null, limits: {} },
    PRO: { priceId: 'price_pro', yearlyPriceId: null, limits: {} },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { POST as affiliateRegisterPOST } from '@/app/api/public/affiliate/register/route';
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { POST as stripeWebhookPOST } from '@/app/api/webhooks/stripe/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/test', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_REGISTER_BODY = {
  email: 'new@salon.com',
  password: 'SecurePass1',
  businessName: 'New Salon',
  phone: '5551234567',
};

// ── POST /api/public/affiliate/register ──────────────────────────────────────

describe('POST /api/public/affiliate/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.affiliate.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.affiliate.create).mockResolvedValue({} as any);
  });

  it('creates affiliate and returns code for valid input', async () => {
    const res = await affiliateRegisterPOST(req('POST', {
      name: 'Jane Smith',
      email: 'jane@example.com',
      payoutInfo: '@jane-venmo',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('AFFCODE1');
    expect(body.message).toBe('Affiliate account created');
    expect(prisma.affiliate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Jane Smith',
          email: 'jane@example.com',
          payoutInfo: '@jane-venmo',
          code: 'AFFCODE1',
        }),
      })
    );
  });

  it('returns 409 for duplicate email', async () => {
    vi.mocked(prisma.affiliate.findUnique).mockResolvedValue({ id: 'existing' } as any);
    const res = await affiliateRegisterPOST(req('POST', {
      name: 'Jane Smith',
      email: 'jane@example.com',
    }));
    expect(res.status).toBe(409);
    expect(prisma.affiliate.create).not.toHaveBeenCalled();
  });

  it('returns 400 for missing name', async () => {
    const res = await affiliateRegisterPOST(req('POST', { email: 'jane@example.com' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email', async () => {
    const res = await affiliateRegisterPOST(req('POST', { name: 'Jane', email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('creates affiliate without payoutInfo when not provided', async () => {
    await affiliateRegisterPOST(req('POST', { name: 'Jane Smith', email: 'jane2@example.com' }));
    const createCall = vi.mocked(prisma.affiliate.create).mock.calls[0][0];
    expect(createCall.data.payoutInfo).toBeNull();
  });
});

// ── Registration with affiliate code ─────────────────────────────────────────

describe('POST /api/auth/register — affiliate code handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.business.create).mockResolvedValue({
      id: 'biz-new',
      email: 'new@salon.com',
      name: 'New Salon',
      slug: 'new-salon',
    } as any);
    vi.mocked(prisma.businessHours.create).mockResolvedValue({} as any);
    vi.mocked(prisma.referral.create).mockResolvedValue({} as any);
    vi.mocked(prisma.affiliateSignup.create).mockResolvedValue({} as any);
  });

  it('valid affiliate code: sets affiliateCodeUsed, creates AffiliateSignup, 44-day trial', async () => {
    const affiliate = { id: 'aff-1', code: 'AFFCODE1', active: true };
    vi.mocked(prisma.affiliate.findUnique).mockResolvedValue(affiliate as any);

    const res = await registerPOST(req('POST', { ...VALID_REGISTER_BODY, affiliateCode: 'AFFCODE1' }));
    expect(res.status).toBe(200);

    // Trial should be ~44 days
    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    const trialEndsAt: Date = createCall.data.trialEndsAt;
    const daysDiff = Math.round((trialEndsAt.getTime() - Date.now()) / 86400000);
    expect(daysDiff).toBeGreaterThanOrEqual(43);
    expect(daysDiff).toBeLessThanOrEqual(44);

    expect(createCall.data.affiliateCodeUsed).toBe('AFFCODE1');

    expect(prisma.affiliateSignup.create).toHaveBeenCalledWith({
      data: { affiliateId: 'aff-1', businessId: 'biz-new' },
    });
  });

  it('invalid affiliate code: succeeds normally with 14-day trial', async () => {
    vi.mocked(prisma.affiliate.findUnique).mockResolvedValue(null);

    const res = await registerPOST(req('POST', { ...VALID_REGISTER_BODY, affiliateCode: 'BADCODE' }));
    expect(res.status).toBe(200);

    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    const trialEndsAt: Date = createCall.data.trialEndsAt;
    const daysDiff = Math.round((trialEndsAt.getTime() - Date.now()) / 86400000);
    expect(daysDiff).toBeLessThanOrEqual(14);

    expect(prisma.affiliateSignup.create).not.toHaveBeenCalled();
  });

  it('referralCode takes priority over affiliateCode when both supplied', async () => {
    const referrer = { id: 'biz-referrer', referralCode: 'REFCODE1', name: 'Referring Salon' };
    vi.mocked(prisma.business.findUnique).mockImplementation(({ where }: any) => {
      if (where.referralCode === 'REFCODE1') return Promise.resolve(referrer as any);
      return Promise.resolve(null);
    });
    vi.mocked(prisma.affiliate.findUnique).mockResolvedValue({ id: 'aff-1', code: 'AFFCODE1' } as any);

    const res = await registerPOST(req('POST', {
      ...VALID_REGISTER_BODY,
      referralCode: 'REFCODE1',
      affiliateCode: 'AFFCODE1',
    }));
    expect(res.status).toBe(200);

    // Referral record created (not affiliate)
    expect(prisma.referral.create).toHaveBeenCalled();
    expect(prisma.affiliateSignup.create).not.toHaveBeenCalled();
  });
});

// ── Stripe webhook — AffiliateSignup earned ───────────────────────────────────

describe('Stripe webhook — invoice.payment_succeeded affiliate tracking', () => {
  const refereeBiz = { id: 'biz-referee', stripeCustomerId: 'cus_referee' };

  function makeInvoiceEvent(amount_paid: number) {
    return {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          customer: 'cus_referee',
          amount_paid,
          currency: 'usd',
          id: 'inv_001',
          payment_intent: amount_paid > 0 ? 'pi_001' : null,
          status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
          hosted_invoice_url: null,
          invoice_pdf: null,
          lines: { data: [{ description: 'Subscription', period: { start: 1700000000, end: 1702592000 } }] },
        },
      },
    };
  }

  function webhookReq(amount_paid = 2900) {
    return new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify(makeInvoiceEvent(amount_paid)),
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_test' },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeInvoiceEvent(2900) as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue(refereeBiz as any);
    vi.mocked(prisma.payment.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.invoice.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);
    vi.mocked(prisma.referral.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.affiliateSignup.update).mockResolvedValue({} as any);
  });

  it('marks AffiliateSignup as earned when pending signup exists and invoice > $0', async () => {
    vi.mocked(prisma.affiliateSignup.findFirst).mockResolvedValue({
      id: 'asup-1',
      status: 'pending',
      affiliateId: 'aff-1',
    } as any);

    const res = await stripeWebhookPOST(webhookReq());
    expect(res.status).toBe(200);

    expect(prisma.affiliateSignup.update).toHaveBeenCalledWith({
      where: { id: 'asup-1' },
      data: { status: 'earned', earnedAt: expect.any(Date) },
    });
  });

  it('does NOT mark earned when invoice amount is $0', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeInvoiceEvent(0) as any);
    vi.mocked(prisma.affiliateSignup.findFirst).mockResolvedValue({
      id: 'asup-1',
      status: 'pending',
    } as any);

    await stripeWebhookPOST(webhookReq(0));

    expect(prisma.affiliateSignup.update).not.toHaveBeenCalled();
  });

  it('does NOT error when no pending AffiliateSignup exists', async () => {
    vi.mocked(prisma.affiliateSignup.findFirst).mockResolvedValue(null);

    const res = await stripeWebhookPOST(webhookReq());
    expect(res.status).toBe(200);
    expect(prisma.affiliateSignup.update).not.toHaveBeenCalled();
  });
});
