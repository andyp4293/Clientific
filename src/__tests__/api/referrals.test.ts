/**
 * Tests for the referral program:
 * - Registration with valid/invalid/no referral code
 * - GET /api/referrals (auth + data shape)
 * - Stripe webhook crediting referrer on first paid invoice
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    businessHours: { create: vi.fn() },
    referral: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    payment: { upsert: vi.fn() },
    invoice: { upsert: vi.fn() },
    notification: { create: vi.fn() },
    affiliate: { findFirst: vi.fn() },
    affiliateSignup: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() },
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
  generateReferralCode: vi.fn().mockResolvedValue('NEWCODE1'),
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
import { getServerSession } from 'next-auth';
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { GET as referralsGET } from '@/app/api/referrals/route';
import { POST as stripeWebhookPOST } from '@/app/api/webhooks/stripe/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION = { user: { email: 'owner@test.com', businessId: 'biz-1', id: 'biz-1' } };

function req(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/test', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_REGISTER_BODY = {
  email: 'new@salon.com',
  password: 'SecurePass1!',
  businessName: 'New Salon',
  businessType: 'Salon',
  phone: '5551234567',
};

// ── Registration + Referral Code ──────────────────────────────────────────────

describe('POST /api/auth/register — referral code handling', () => {
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
  });

  it('no referral code — creates 14-day trial', async () => {
    const res = await registerPOST(req('POST', VALID_REGISTER_BODY));
    expect(res.status).toBe(200);

    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    const trialEndsAt = new Date(createCall.data.trialEndsAt as string | number | Date);
    const daysDiff = Math.round((trialEndsAt.getTime() - Date.now()) / 86400000);
    expect(daysDiff).toBeGreaterThanOrEqual(13);
    expect(daysDiff).toBeLessThanOrEqual(14);

    // No referral record created
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('valid referral code — creates 44-day trial and referral record', async () => {
    const referrer = {
      id: 'biz-referrer',
      referralCode: 'ABCD1234',
      name: 'Referring Salon',
    };
    // findUnique returns null for all calls EXCEPT the referral code lookup
    vi.mocked(prisma.business.findUnique).mockImplementation((({ where }: any) => {
      if (where.referralCode === 'ABCD1234') return Promise.resolve(referrer as any);
      return Promise.resolve(null);
    }) as any);

    const res = await registerPOST(req('POST', { ...VALID_REGISTER_BODY, referralCode: 'ABCD1234' }));
    expect(res.status).toBe(200);

    // Trial should be ~44 days
    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    const trialEndsAt = new Date(createCall.data.trialEndsAt as string | number | Date);
    const daysDiff = Math.round((trialEndsAt.getTime() - Date.now()) / 86400000);
    expect(daysDiff).toBeGreaterThanOrEqual(43);
    expect(daysDiff).toBeLessThanOrEqual(44);

    // referredById set on new business
    expect(createCall.data.referredById).toBe('biz-referrer');

    // Referral record created
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: { referrerId: 'biz-referrer', refereeId: 'biz-new' },
    });
  });

  it('invalid referral code — ignores silently, creates 14-day trial', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null); // no match for code

    const res = await registerPOST(req('POST', { ...VALID_REGISTER_BODY, referralCode: 'BADCODE' }));
    expect(res.status).toBe(200);

    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    const trialEndsAt = new Date(createCall.data.trialEndsAt as string | number | Date);
    const daysDiff = Math.round((trialEndsAt.getTime() - Date.now()) / 86400000);
    expect(daysDiff).toBeLessThanOrEqual(14);

    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('new business always gets its own referral code assigned', async () => {
    const res = await registerPOST(req('POST', VALID_REGISTER_BODY));
    expect(res.status).toBe(200);

    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    expect(createCall.data.referralCode).toBe('NEWCODE1');
  });
});

// ── GET /api/referrals ────────────────────────────────────────────────────────

describe('GET /api/referrals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await referralsGET();
    expect(res.status).toBe(401);
  });

  it('returns referral code, credits, and referral list', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      referralCode: 'MYCODE12',
      referralCredits: 30,
      referralsMade: [
        {
          id: 'ref-1',
          createdAt: new Date('2026-03-01'),
          status: 'credited',
          creditAmount: 15,
          creditedAt: new Date('2026-03-15'),
          referee: { name: 'Janes Salon', createdAt: new Date('2026-03-01') },
        },
        {
          id: 'ref-2',
          createdAt: new Date('2026-03-05'),
          status: 'pending',
          creditAmount: 15,
          creditedAt: null,
          referee: { name: 'Cut & Color', createdAt: new Date('2026-03-05') },
        },
      ],
    } as any);

    const res = await referralsGET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.referralCode).toBe('MYCODE12');
    expect(body.totalCredits).toBe(30);
    expect(body.referrals).toHaveLength(2);
    expect(body.referrals[0].status).toBe('credited');
    expect(body.referrals[1].status).toBe('pending');
  });

  it('returns 404 if business not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);
    const res = await referralsGET();
    expect(res.status).toBe(404);
  });
});

// ── Stripe Webhook — Referral Credit ─────────────────────────────────────────

describe('Stripe webhook — invoice.payment_succeeded referral credit', () => {
  const referrerBiz = { id: 'biz-referrer', stripeCustomerId: 'cus_referrer' };
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
          payment_intent: 'pi_001',
          status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
          hosted_invoice_url: null,
          invoice_pdf: null,
          lines: { data: [{ description: 'Subscription', period: { start: 1700000000, end: 1702592000 } }] },
        },
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeInvoiceEvent(2900) as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue(refereeBiz as any);
    vi.mocked(prisma.payment.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.invoice.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);
    vi.mocked(prisma.referral.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.affiliateSignup.findFirst).mockResolvedValue(null);
  });

  function webhookReq() {
    return new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify(makeInvoiceEvent(2900)),
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_test' },
    });
  }

  it('credits referrer a percentage of the invoice when pending referral exists', async () => {
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({
      id: 'ref-1',
      status: 'pending',
      referrerId: 'biz-referrer',
      referrer: referrerBiz,
    } as any);
    vi.mocked(prisma.referral.update).mockResolvedValue({} as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);

    const res = await stripeWebhookPOST(webhookReq());
    expect(res.status).toBe(200);

    // Invoice is $29 (2900 cents); 20% commission = 580 cents
    const { REFERRAL_COMMISSION_PERCENT } = await import('@/lib/referral-config');
    const expectedCents = Math.round(2900 * REFERRAL_COMMISSION_PERCENT);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith(
      'cus_referrer',
      expect.objectContaining({ amount: -expectedCents, currency: 'usd' })
    );
  });

  it('payout scales with subscription plan price', async () => {
    // Higher plan invoice ($79 = 7900 cents) should yield a larger credit
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeInvoiceEvent(7900) as any);
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({
      id: 'ref-2',
      status: 'pending',
      referrerId: 'biz-referrer',
      referrer: referrerBiz,
    } as any);
    vi.mocked(prisma.referral.update).mockResolvedValue({} as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);

    await stripeWebhookPOST(
      new NextRequest('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(makeInvoiceEvent(7900)),
        headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_test' },
      })
    );

    const { REFERRAL_COMMISSION_PERCENT } = await import('@/lib/referral-config');
    const expectedCents = Math.round(7900 * REFERRAL_COMMISSION_PERCENT);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith(
      'cus_referrer',
      expect.objectContaining({ amount: -expectedCents, currency: 'usd' })
    );
  });

  it('does NOT credit referrer if referral already credited', async () => {
    // No pending referral found
    vi.mocked(prisma.referral.findFirst).mockResolvedValue(null);

    await stripeWebhookPOST(webhookReq());

    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });

  it('does NOT credit referrer when invoice amount is $0 (e.g. trial start)', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeInvoiceEvent(0) as any);
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({
      id: 'ref-1',
      status: 'pending',
      referrerId: 'biz-referrer',
      referrer: referrerBiz,
    } as any);

    await stripeWebhookPOST(webhookReq());

    // findFirst not called for zero-amount invoices
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });

  it('does NOT credit if referrer has no stripeCustomerId', async () => {
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({
      id: 'ref-1',
      status: 'pending',
      referrerId: 'biz-referrer',
      referrer: { id: 'biz-referrer', stripeCustomerId: null },
    } as any);

    await stripeWebhookPOST(webhookReq());

    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
});
