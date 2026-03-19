/**
 * Billing API Route Tests
 *
 * Covers:
 *   POST /api/billing/portal    — Stripe Billing Portal session creation
 *   GET  /api/billing/details   — Payment method + invoice history
 *   GET  /api/billing/subscription — Subscription info
 *   POST /api/checkout/create   — Stripe Checkout session creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks (must be declared before any imports that use these modules) ─────

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: vi.fn() },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { retrieve: vi.fn() },
    invoices: { list: vi.fn() },
    paymentMethods: { retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
  // Inline — vi.mock factories are hoisted; no external variables allowed
  PRICING_PLANS: {
    STARTER: {
      name: 'Clientific', summary: 'One simple plan', price: 49, yearlyPrice: 39,
      priceId: 'price_starter_monthly', yearlyPriceId: 'price_starter_yearly',
      features: ['Up to 100 customers'],
      limits: { customers: 100, staff: 2, services: 10 },
      popular: true,
      selfServe: true,
      supportsYearly: false,
      legacy: false,
    },
    PRO: {
      name: 'Pro', summary: 'Legacy plan', price: 79, yearlyPrice: 63,
      priceId: 'price_pro_monthly', yearlyPriceId: 'price_pro_yearly',
      features: ['Up to 1,000 customers'],
      limits: { customers: 1000, staff: 10, services: 50 },
      popular: false,
      selfServe: false,
      supportsYearly: true,
      legacy: true,
    },
    PREMIUM: {
      name: 'Premium', summary: 'Legacy plan', price: 149, yearlyPrice: 119,
      priceId: 'price_premium_monthly', yearlyPriceId: 'price_premium_yearly',
      features: ['Unlimited customers'],
      limits: { customers: Infinity, staff: Infinity, services: Infinity },
      popular: false,
      selfServe: false,
      supportsYearly: true,
      legacy: true,
    },
  },
}));

vi.mock('@/lib/subscription', () => ({
  getSubscriptionInfo: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getSubscriptionInfo } from '@/lib/subscription';

// Route handlers
import { POST as portalPost } from '@/app/api/billing/portal/route';
import { GET as detailsGet } from '@/app/api/billing/details/route';
import { GET as subscriptionGet } from '@/app/api/billing/subscription/route';
import { POST as checkoutPost } from '@/app/api/checkout/create/route';

// ── Helpers ───────────────────────────────────────────────────────────────

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.business.update as ReturnType<typeof vi.fn>;
const mockCustomerCreate = stripe.customers.create as ReturnType<typeof vi.fn>;
const mockPortalCreate = stripe.billingPortal.sessions.create as ReturnType<typeof vi.fn>;
const mockSubRetrieve = stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>;
const mockInvoiceList = stripe.invoices.list as ReturnType<typeof vi.fn>;
const mockCheckoutCreate = stripe.checkout.sessions.create as ReturnType<typeof vi.fn>;
const mockGetSubscriptionInfo = getSubscriptionInfo as ReturnType<typeof vi.fn>;

const makeBusiness = (overrides = {}) => ({
  id: 'biz-1',
  email: 'test@example.com',
  name: 'Test Business',
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_123',
  subscriptionPlan: 'starter',
  subscriptionStatus: 'active',
  ...overrides,
});

function makeReq(url: string, method = 'GET', body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/billing/portal
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/billing/portal', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await portalPost(makeReq('http://localhost:3000/api/billing/portal', 'POST'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when business not found', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(null);
    const res = await portalPost(makeReq('http://localhost:3000/api/billing/portal', 'POST'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Business not found');
  });

  it('returns portal URL for a business with an existing Stripe customer', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness());
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session_abc' });

    const res = await portalPost(makeReq('http://localhost:3000/api/billing/portal', 'POST'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://billing.stripe.com/session_abc');
  });

  it('creates a Stripe customer on-the-fly when none exists (trial user)', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeCustomerId: null }));
    mockCustomerCreate.mockResolvedValue({ id: 'cus_new' });
    mockUpdate.mockResolvedValue({});
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session_new' });

    const res = await portalPost(makeReq('http://localhost:3000/api/billing/portal', 'POST'));
    expect(res.status).toBe(200);

    // Customer was created
    expect(mockCustomerCreate).toHaveBeenCalledWith(expect.objectContaining({
      email: 'test@example.com',
      name: 'Test Business',
    }));
    // Customer ID was persisted
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { stripeCustomerId: 'cus_new' },
    }));

    const body = await res.json();
    expect(body.url).toBe('https://billing.stripe.com/session_new');
  });

  it('uses the request origin as return_url when NEXT_PUBLIC_APP_URL is not set', async () => {
    const origEnv = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness());
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session_fallback' });

    await portalPost(makeReq('http://myapp.vercel.app/api/billing/portal', 'POST'));

    expect(mockPortalCreate).toHaveBeenCalledWith(expect.objectContaining({
      return_url: 'http://myapp.vercel.app/dashboard/settings/billing',
    }));

    process.env.NEXT_PUBLIC_APP_URL = origEnv;
  });

  it('uses NEXT_PUBLIC_APP_URL as return_url when set', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://clientific.app';

    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness());
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session_env' });

    await portalPost(makeReq('http://localhost:3000/api/billing/portal', 'POST'));

    expect(mockPortalCreate).toHaveBeenCalledWith(expect.objectContaining({
      return_url: 'https://clientific.app/dashboard/settings/billing',
    }));
  });

  it('returns 500 on Stripe error', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness());
    mockPortalCreate.mockRejectedValue(new Error('Stripe error'));

    const res = await portalPost(makeReq('http://localhost:3000/api/billing/portal', 'POST'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Stripe error');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/billing/details
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/billing/details', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await detailsGet(makeReq('http://localhost:3000/api/billing/details'));
    expect(res.status).toBe(401);
  });

  it('returns empty data when no Stripe customer exists', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue({ stripeCustomerId: null, stripeSubscriptionId: null });

    const res = await detailsGet(makeReq('http://localhost:3000/api/billing/details'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentMethod).toBeNull();
    expect(body.invoices).toEqual([]);
  });

  it('returns payment method from subscription default_payment_method', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeCustomerId: 'cus_123', stripeSubscriptionId: 'sub_123' }));

    mockSubRetrieve.mockResolvedValue({
      default_payment_method: {
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2027, funding: 'credit' },
      },
      customer: {},
    });
    mockInvoiceList.mockResolvedValue({ data: [] });

    const res = await detailsGet(makeReq('http://localhost:3000/api/billing/details'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentMethod).toMatchObject({
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2027,
      funding: 'credit',
    });
  });

  it('returns null payment method when subscription has no card', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness());

    mockSubRetrieve.mockResolvedValue({
      default_payment_method: null,
      customer: { invoice_settings: { default_payment_method: null } },
    });
    mockInvoiceList.mockResolvedValue({ data: [] });

    const res = await detailsGet(makeReq('http://localhost:3000/api/billing/details'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentMethod).toBeNull();
  });

  it('returns mapped invoice list', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeSubscriptionId: null }));
    mockInvoiceList.mockResolvedValue({
      data: [
        {
          id: 'in_abc123',
          number: 'INV-0001',
          amount_paid: 2900,
          amount_due: 2900,
          currency: 'usd',
          status: 'paid',
          created: 1700000000,
          period_start: 1697000000,
          period_end: 1700000000,
          hosted_invoice_url: 'https://invoice.stripe.com/i/abc',
          invoice_pdf: 'https://invoice.stripe.com/i/abc/pdf',
          lines: { data: [{ description: 'Starter plan' }] },
        },
      ],
    });

    const res = await detailsGet(makeReq('http://localhost:3000/api/billing/details'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoices).toHaveLength(1);
    expect(body.invoices[0]).toMatchObject({
      id: 'in_abc123',
      number: 'INV-0001',
      amountPaid: 2900,
      currency: 'usd',
      status: 'paid',
      description: 'Starter plan',
      invoicePdf: 'https://invoice.stripe.com/i/abc/pdf',
    });
  });

  it('returns 500 on unexpected error', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockRejectedValue(new Error('DB failure'));

    const res = await detailsGet(makeReq('http://localhost:3000/api/billing/details'));
    expect(res.status).toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/billing/subscription
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/billing/subscription', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await subscriptionGet(makeReq('http://localhost:3000/api/billing/subscription'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when business not found', async () => {
    mockSession.mockResolvedValue({ user: { id: 'biz-1', email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(null);
    const res = await subscriptionGet(makeReq('http://localhost:3000/api/billing/subscription'));
    expect(res.status).toBe(404);
  });

  it('returns subscription info for an active subscriber', async () => {
    mockSession.mockResolvedValue({ user: { id: 'biz-1', email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness());
    mockGetSubscriptionInfo.mockResolvedValue({
      subscriptionPlan: 'starter',
      subscriptionStatus: 'active',
      trialEndsAt: null,
      stripeCurrentPeriodEnd: '2026-04-06T00:00:00Z',
      trialDaysRemaining: null,
      isActive: true,
    });

    const res = await subscriptionGet(makeReq('http://localhost:3000/api/billing/subscription'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscriptionStatus).toBe('active');
    expect(body.isActive).toBe(true);
    expect(body.trialDaysRemaining).toBeNull();
  });

  it('returns trial days remaining for a trialing subscriber', async () => {
    mockSession.mockResolvedValue({ user: { id: 'biz-1', email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ subscriptionStatus: 'trialing' }));
    mockGetSubscriptionInfo.mockResolvedValue({
      subscriptionPlan: 'starter',
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      stripeCurrentPeriodEnd: null,
      trialDaysRemaining: 7,
      isActive: true,
    });

    const res = await subscriptionGet(makeReq('http://localhost:3000/api/billing/subscription'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscriptionStatus).toBe('trialing');
    expect(body.trialDaysRemaining).toBe(7);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/checkout/create
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/checkout/create', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'starter' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when plan is missing', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    const res = await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Plan is required');
  });

  it('returns 400 for an invalid plan name', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    const res = await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'enterprise' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid plan');
  });

  it('returns 404 when business not found', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(null);
    const res = await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'starter' }));
    expect(res.status).toBe(404);
  });

  it('creates checkout session with 14-day trial for a first-time subscriber', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeSubscriptionId: null }));
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_new' });

    const res = await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'starter', billingPeriod: 'monthly' }));
    expect(res.status).toBe(200);

    expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      subscription_data: expect.objectContaining({ trial_period_days: 14 }),
      line_items: expect.arrayContaining([
        expect.objectContaining({ price: 'price_starter_monthly', quantity: 1 }),
      ]),
    }));

    const body = await res.json();
    expect(body.url).toBe('https://checkout.stripe.com/session_new');
  });

  it('accepts the public base slug and maps it to the starter Stripe price IDs', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeSubscriptionId: null }));
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_base' });

    const res = await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'base', billingPeriod: 'monthly' }));
    expect(res.status).toBe(200);

    expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: expect.arrayContaining([
        expect.objectContaining({ price: 'price_starter_monthly', quantity: 1 }),
      ]),
      subscription_data: expect.objectContaining({
        metadata: expect.objectContaining({ plan: 'base' }),
      }),
      metadata: expect.objectContaining({ plan: 'base' }),
    }));
  });

  it('creates checkout session without trial for a returning subscriber', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeSubscriptionId: 'sub_existing' }));
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_returning' });

    await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'pro', billingPeriod: 'monthly' }));

    const callArgs = mockCheckoutCreate.mock.calls[0][0];
    expect(callArgs.subscription_data.trial_period_days).toBeUndefined();
  });

  it('uses yearly price ID when billingPeriod is yearly', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeSubscriptionId: null }));
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_yearly' });

    await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'pro', billingPeriod: 'yearly' }));

    expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: expect.arrayContaining([
        expect.objectContaining({ price: 'price_pro_yearly' }),
      ]),
    }));
  });

  it('creates a Stripe customer when none exists and saves the ID', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeCustomerId: null, stripeSubscriptionId: null }));
    mockCustomerCreate.mockResolvedValue({ id: 'cus_brand_new' });
    mockUpdate.mockResolvedValue({});
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_no_cus' });

    const res = await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'starter' }));
    expect(res.status).toBe(200);

    expect(mockCustomerCreate).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { stripeCustomerId: 'cus_brand_new' },
    }));
  });

  it('uses request origin as success/cancel URL when NEXT_PUBLIC_APP_URL is not set', async () => {
    const origEnv = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeSubscriptionId: null }));
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_origin' });

    await checkoutPost(makeReq('https://clientific.app/api/checkout/create', 'POST', { plan: 'starter' }));

    expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      success_url: 'https://clientific.app/dashboard?checkout=success',
      cancel_url: 'https://clientific.app/pricing?checkout=canceled',
    }));

    process.env.NEXT_PUBLIC_APP_URL = origEnv;
  });

  it('returns 500 on Stripe error', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeSubscriptionId: null }));
    mockCheckoutCreate.mockRejectedValue(new Error('Stripe network error'));

    const res = await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'starter' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Stripe network error');
  });

  it('returns a safe checkout error when Stripe rejects the configured price ID', async () => {
    mockSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockFindUnique.mockResolvedValue(makeBusiness({ stripeSubscriptionId: null }));
    mockCheckoutCreate.mockRejectedValue(
      new Error("No such price: 'price_1TCTdH0hFQoOoQppM7SXMmDN\\n'")
    );

    const res = await checkoutPost(makeReq('http://localhost:3000/api/checkout/create', 'POST', { plan: 'base' }));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe('Checkout is temporarily unavailable. Please try again in a moment.');
  });
});
