import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    businessBankAccount: {
      deleteMany: vi.fn(),
    },
    businessHours: { create: vi.fn() },
    referral: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    referralCommission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    payment: { upsert: vi.fn() },
    invoice: { upsert: vi.fn() },
    notification: { create: vi.fn() },
    affiliate: { findFirst: vi.fn() },
    affiliateSignup: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock('@/lib/stripe-connect', () => ({
  syncBusinessConnectState: vi.fn(),
  isRecoverableConnectAccountError: vi.fn(),
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
    transfers: { create: vi.fn().mockResolvedValue({ id: 'tr_referral_1' }) },
    subscriptions: { retrieve: vi.fn() },
  },
  PRICING_PLANS: {
    STARTER: { priceId: 'price_starter', yearlyPriceId: null, limits: {} },
    PRO: { priceId: 'price_pro', yearlyPriceId: null, limits: {} },
  },
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  isRecoverableConnectAccountError,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';
import { getServerSession } from 'next-auth';
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { GET as referralsGET } from '@/app/api/referrals/route';
import { POST as stripeWebhookPOST } from '@/app/api/webhooks/stripe/route';

const mockReferralCommissionFindUnique =
  prisma.referralCommission.findUnique as ReturnType<typeof vi.fn>;
const mockReferralCommissionFindMany =
  prisma.referralCommission.findMany as ReturnType<typeof vi.fn>;
const mockTransferCreate = stripe.transfers.create as ReturnType<typeof vi.fn>;
const mockSyncBusinessConnectState =
  syncBusinessConnectState as ReturnType<typeof vi.fn>;
const mockIsRecoverableConnectAccountError =
  isRecoverableConnectAccountError as ReturnType<typeof vi.fn>;

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

describe('POST /api/auth/register - referral code handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRecoverableConnectAccountError.mockReturnValue(false);
    mockSyncBusinessConnectState.mockResolvedValue({
      accountId: 'acct_referrer',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      bankAccountConnected: true,
      externalAccount: null,
      payoutSchedule: {
        interval: 'manual',
        monthlyPayoutDays: [],
        weeklyPayoutDays: [],
        statementDescriptor: null,
      },
      requirements: {
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        pendingVerification: [],
        disabledReason: null,
      },
    });
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

  it('no referral code creates a standard 14-day trial', async () => {
    const res = await registerPOST(req('POST', VALID_REGISTER_BODY));
    expect(res.status).toBe(200);

    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    const trialEndsAt = new Date(createCall.data.trialEndsAt as string | number | Date);
    const daysDiff = Math.round((trialEndsAt.getTime() - Date.now()) / 86400000);
    expect(daysDiff).toBeGreaterThanOrEqual(13);
    expect(daysDiff).toBeLessThanOrEqual(14);
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('valid referral code creates a referral record and links the referrer', async () => {
    const referrer = {
      id: 'biz-referrer',
      referralCode: 'ABCD1234',
      name: 'Referring Salon',
      stripeConnectAccountId: 'acct_referrer',
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
    };

    vi.mocked(prisma.business.findUnique).mockImplementation((({ where }: any) => {
      if (where.referralCode === 'ABCD1234') return Promise.resolve(referrer as any);
      return Promise.resolve(null);
    }) as any);

    const res = await registerPOST(
      req('POST', { ...VALID_REGISTER_BODY, referralCode: 'ABCD1234' })
    );
    expect(res.status).toBe(200);

    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    expect(createCall.data.referredById).toBe('biz-referrer');
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: { referrerId: 'biz-referrer', refereeId: 'biz-new' },
    });
  });

  it('ignores referral codes until the referrer has finished payout setup', async () => {
    const referrer = {
      id: 'biz-referrer',
      referralCode: 'ABCD1234',
      name: 'Referring Salon',
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
    };

    vi.mocked(prisma.business.findUnique).mockImplementation((({ where }: any) => {
      if (where.referralCode === 'ABCD1234') return Promise.resolve(referrer as any);
      return Promise.resolve(null);
    }) as any);

    const res = await registerPOST(
      req('POST', { ...VALID_REGISTER_BODY, referralCode: 'ABCD1234' })
    );
    expect(res.status).toBe(200);

    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    expect(createCall.data.referredById).toBeUndefined();
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('invalid referral code is ignored without breaking registration', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);

    const res = await registerPOST(
      req('POST', { ...VALID_REGISTER_BODY, referralCode: 'BADCODE' })
    );
    expect(res.status).toBe(200);
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('every new business receives its own referral code', async () => {
    const res = await registerPOST(req('POST', VALID_REGISTER_BODY));
    expect(res.status).toBe(200);

    const createCall = vi.mocked(prisma.business.create).mock.calls[0][0];
    expect(createCall.data.referralCode).toBe('NEWCODE1');
  });
});

describe('GET /api/referrals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without a session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await referralsGET();
    expect(res.status).toBe(401);
  });

  it('returns referral code, earned credits, and the referral list', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      referralCode: 'MYCODE12',
      stripeConnectAccountId: 'acct_referrer',
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
      referralsMade: [
        {
          id: 'ref-1',
          createdAt: new Date('2026-03-01'),
          status: 'credited',
          creditedAt: new Date('2026-03-15'),
          commissions: [{ amountDollars: 15 }],
          referee: { name: 'Janes Salon', createdAt: new Date('2026-03-01') },
        },
        {
          id: 'ref-2',
          createdAt: new Date('2026-03-05'),
          status: 'pending',
          creditedAt: null,
          commissions: [{ amountDollars: 15 }],
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
    expect(body.payoutReady).toBe(true);
    expect(body.referrals[0].status).toBe('credited');
    expect(body.referrals[1].status).toBe('pending');
  });

  it('keeps referral history visible but hides sharing until payouts are ready', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      referralCode: 'MYCODE12',
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
      referralsMade: [
        {
          id: 'ref-1',
          createdAt: new Date('2026-03-01'),
          status: 'credited',
          creditedAt: new Date('2026-03-15'),
          commissions: [{ amountDollars: 15 }],
          referee: { name: 'Janes Salon', createdAt: new Date('2026-03-01') },
        },
      ],
    } as any);

    const res = await referralsGET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.referralCode).toBeNull();
    expect(body.payoutReady).toBe(false);
    expect(body.payoutStatusCode).toBe('not_connected');
    expect(body.payoutSetupMessage).toMatch(/finish payout setup/i);
    expect(body.referrals).toHaveLength(1);
  });

  it('derives referral totals from commission rows instead of stale cached totals', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      referralCode: 'MYCODE12',
      stripeConnectAccountId: 'acct_referrer',
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
      referralsMade: [
        {
          id: 'ref-1',
          createdAt: new Date('2026-03-01'),
          status: 'active',
          creditedAt: new Date('2026-03-15'),
          commissions: [{ amountDollars: 14.7 }],
          referee: { name: 'Jackson Nails', createdAt: new Date('2026-03-01') },
        },
      ],
    } as any);

    const res = await referralsGET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totalCredits).toBeCloseTo(14.7, 5);
    expect(body.referrals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ref-1',
          creditAmount: 14.7,
        }),
      ])
    );
  });

  it('returns 404 when the business cannot be found', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);
    const res = await referralsGET();
    expect(res.status).toBe(404);
  });
});

describe('Stripe webhook - invoice.payment_succeeded referral credit', () => {
  const referrerBizReady = {
    id: 'biz-referrer',
    stripeConnectAccountId: 'acct_referrer',
    stripeConnectChargesEnabled: true,
    stripeConnectPayoutsEnabled: true,
    stripeConnectDetailsSubmitted: true,
  };

  const referrerBizNotReady = {
    id: 'biz-referrer',
    stripeConnectAccountId: null,
    stripeConnectChargesEnabled: false,
    stripeConnectPayoutsEnabled: false,
    stripeConnectDetailsSubmitted: false,
  };

  const refereeBiz = { id: 'biz-referee', stripeCustomerId: 'cus_referee' };

  function makeInvoiceEvent(amountPaid: number) {
    return {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          customer: 'cus_referee',
          amount_paid: amountPaid,
          currency: 'usd',
          id: 'inv_001',
          payment_intent: 'pi_001',
          status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
          hosted_invoice_url: null,
          invoice_pdf: null,
          lines: {
            data: [
              {
                description: 'Subscription',
                period: { start: 1700000000, end: 1702592000 },
              },
            ],
          },
        },
      },
    };
  }

  function webhookReq(amountPaid = 2900) {
    return new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify(makeInvoiceEvent(amountPaid)),
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_test' },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      makeInvoiceEvent(2900) as any
    );
    vi.mocked(prisma.business.findUnique).mockResolvedValue(refereeBiz as any);
    vi.mocked(prisma.payment.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.invoice.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);
    vi.mocked(prisma.referral.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.referral.update).mockResolvedValue({} as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);
    vi.mocked(prisma.referralCommission.create).mockResolvedValue({} as any);
    vi.mocked(prisma.referralCommission.update).mockResolvedValue({} as any);
    vi.mocked(prisma.affiliateSignup.findFirst).mockResolvedValue(null);
    mockReferralCommissionFindUnique.mockResolvedValue(null);
    mockReferralCommissionFindMany.mockResolvedValue([
      {
        id: 'comm_1',
        stripeInvoiceId: 'inv_001',
        amountDollars: 8.7,
      },
    ]);
    mockTransferCreate.mockResolvedValue({ id: 'tr_referral_1' });
  });

  it('records and transfers recurring commission into Stripe Connect when the referrer is payout-ready', async () => {
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({
      id: 'ref-1',
      status: 'pending',
      referrerId: 'biz-referrer',
      referrer: referrerBizReady,
    } as any);

    const res = await stripeWebhookPOST(webhookReq());
    expect(res.status).toBe(200);

    const { REFERRAL_COMMISSION_PERCENT } = await import('@/lib/referral-config');
    const expectedCents = Math.round(2900 * REFERRAL_COMMISSION_PERCENT);
    expect(prisma.referralCommission.create).toHaveBeenCalledWith({
      data: {
        referralId: 'ref-1',
        stripeInvoiceId: 'inv_001',
        amountDollars: expectedCents / 100,
      },
    });
    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: expectedCents,
        currency: 'usd',
        destination: 'acct_referrer',
      }),
      { idempotencyKey: 'referral-commission-comm_1' }
    );
  });

  it('scales the payout amount with the invoice total', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      makeInvoiceEvent(7900) as any
    );
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({
      id: 'ref-2',
      status: 'active',
      referrerId: 'biz-referrer',
      referrer: referrerBizReady,
    } as any);
    mockReferralCommissionFindMany.mockResolvedValue([
      {
        id: 'comm_2',
        stripeInvoiceId: 'inv_001',
        amountDollars: 23.7,
      },
    ]);

    await stripeWebhookPOST(webhookReq(7900));

    const { REFERRAL_COMMISSION_PERCENT } = await import('@/lib/referral-config');
    const expectedCents = Math.round(7900 * REFERRAL_COMMISSION_PERCENT);
    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: expectedCents,
        destination: 'acct_referrer',
      }),
      { idempotencyKey: 'referral-commission-comm_2' }
    );
  });

  it('keeps earnings stacked in the database even when the referrer has not set up payouts yet', async () => {
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({
      id: 'ref-1',
      status: 'pending',
      referrerId: 'biz-referrer',
      referrer: referrerBizNotReady,
    } as any);

    await stripeWebhookPOST(webhookReq());

    expect(prisma.referralCommission.create).toHaveBeenCalled();
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-referrer' },
      data: { referralCredits: { increment: 8.7 } },
    });
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it('skips duplicate invoices so the same Stripe invoice is never credited twice', async () => {
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({
      id: 'ref-1',
      status: 'active',
      referrerId: 'biz-referrer',
      referrer: referrerBizReady,
    } as any);
    mockReferralCommissionFindUnique.mockResolvedValue({
      id: 'existing-commission',
      amountDollars: 8.7,
    } as any);
    mockReferralCommissionFindMany.mockResolvedValue([]);

    await stripeWebhookPOST(webhookReq());

    expect(prisma.referralCommission.create).not.toHaveBeenCalled();
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it('does not credit when no referral exists', async () => {
    vi.mocked(prisma.referral.findFirst).mockResolvedValue(null);

    await stripeWebhookPOST(webhookReq());

    expect(prisma.referralCommission.create).not.toHaveBeenCalled();
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it('does not credit on zero-dollar invoices', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      makeInvoiceEvent(0) as any
    );
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({
      id: 'ref-1',
      status: 'pending',
      referrerId: 'biz-referrer',
      referrer: referrerBizReady,
    } as any);

    await stripeWebhookPOST(webhookReq(0));

    expect(prisma.referral.findFirst).not.toHaveBeenCalled();
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });
});
