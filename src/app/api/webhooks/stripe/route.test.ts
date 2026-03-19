import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

/**
 * Real-world webhook tests.
 *
 * stripe.webhooks.constructEvent is NOT mocked — it runs the actual HMAC
 * signature verification. Tests generate properly signed requests using
 * generateTestHeaderString, so any bug in how we read / trim
 * STRIPE_WEBHOOK_SECRET will surface as a test failure, not a silent pass.
 */

// A Stripe instance used only for signature generation — no API calls.
const testStripe = new Stripe('sk_test_placeholder_key_for_build', {
  apiVersion: '2024-12-18.acacia' as any,
});

const TEST_SECRET = 'whsec_testsigningsecretforvitest1234';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/deal-purchases', () => ({
  finalizeDealPurchaseFromCheckoutSession: vi.fn(),
  finalizeDealPurchaseFromPaymentIntent: vi.fn(),
  createDealPurchaseFromPaymentIntent: vi.fn(),
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://clientific.net'),
}));

// Mock @/lib/stripe but keep webhooks real so constructEvent actually runs.
// This means tests exercise the full signature verification path and will
// catch env var issues (e.g. trailing \n in STRIPE_WEBHOOK_SECRET).
vi.mock('@/lib/stripe', async () => {
  const { default: StripeClass } = await import('stripe');
  const real = new StripeClass('sk_test_placeholder_key_for_build', {
    apiVersion: '2024-12-18.acacia' as any,
  });
  return {
    stripe: {
      webhooks: real.webhooks,
      subscriptions: { retrieve: vi.fn() },
    },
    PRICING_PLANS: {
      STARTER: {
        name: 'Starter', price: 29, yearlyPrice: 23,
        priceId: 'price_starter', yearlyPriceId: 'price_starter_yearly',
        limits: { customers: 100, staff: 2, services: 10 }, popular: false,
      },
      PRO: {
        name: 'Pro', price: 79, yearlyPrice: 63,
        priceId: 'price_pro', yearlyPriceId: 'price_pro_yearly',
        limits: { customers: 1000, staff: 10, services: 50 }, popular: true,
      },
      PREMIUM: {
        name: 'Premium', price: 149, yearlyPrice: 119,
        priceId: 'price_premium', yearlyPriceId: 'price_premium_yearly',
        limits: { customers: Infinity, staff: Infinity, services: Infinity }, popular: false,
      },
    },
  };
});

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  finalizeDealPurchaseFromCheckoutSession,
  finalizeDealPurchaseFromPaymentIntent,
} from '@/lib/deal-purchases';
import { POST } from './route';

const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockBusinessUpdate = prisma.business.update as ReturnType<typeof vi.fn>;
const mockNotificationCreate = prisma.notification.create as ReturnType<typeof vi.fn>;

/** Creates a request with a real Stripe-Signature header. */
function makeSignedRequest(event: object, signingSecret = TEST_SECRET) {
  const body = JSON.stringify(event);
  const sig = testStripe.webhooks.generateTestHeaderString({ payload: body, secret: signingSecret });
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
  mockNotificationCreate.mockResolvedValue({});
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

describe('signature verification', () => {
  it('returns 400 when stripe-signature header is absent', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature was computed with the wrong secret', async () => {
    const req = makeSignedRequest({ type: 'customer.subscription.updated', data: { object: {} } }, 'whsec_wrong_secret');
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Webhook Error/i);
  });

  it('accepts the webhook when STRIPE_WEBHOOK_SECRET has a trailing \\n (trims it)', async () => {
    // Simulate the Vercel paste-artifact bug: secret stored with literal \n suffix.
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET + '\n';
    // Sign with the clean secret — the route must trim before comparing.
    const mockFinalizePI = finalizeDealPurchaseFromPaymentIntent as ReturnType<typeof vi.fn>;
    mockFinalizePI.mockResolvedValue({ id: 'p1' });
    const req = makeSignedRequest({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1', metadata: { kind: 'deal_purchase', dealPurchaseId: 'p1' }, status: 'succeeded' } },
    });
    const res = await POST(req);
    // Without .trim() this would be 400 (signature mismatch); with it, 200.
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// customer.subscription.updated
// ---------------------------------------------------------------------------

describe('Stripe webhook — customer.subscription.updated', () => {
  const baseBusiness = { id: 'biz-123', stripeSubscriptionId: 'sub_123' };

  function makeSubscriptionEvent(overrides: Record<string, unknown> = {}) {
    return {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          trial_end: null,
          current_period_end: 1700000000,
          items: { data: [{ price: { id: 'price_pro' } }] },
          ...overrides,
        },
      },
    };
  }

  it('syncs trialEndsAt when trial_end is a timestamp', async () => {
    const trialEnd = 1700000000;
    mockBusinessFindUnique.mockResolvedValue(baseBusiness);
    mockBusinessUpdate.mockResolvedValue({});

    const res = await POST(makeSignedRequest(makeSubscriptionEvent({ trial_end: trialEnd, status: 'active' })));
    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ trialEndsAt: new Date(trialEnd * 1000) }) })
    );
  });

  it('sets trialEndsAt to null when trial_end is null', async () => {
    mockBusinessFindUnique.mockResolvedValue(baseBusiness);
    mockBusinessUpdate.mockResolvedValue({});

    await POST(makeSignedRequest(makeSubscriptionEvent({ trial_end: null })));
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ trialEndsAt: null }) })
    );
  });

  it('writes subscriptionStatus active when trial transitions to active', async () => {
    mockBusinessFindUnique.mockResolvedValue(baseBusiness);
    mockBusinessUpdate.mockResolvedValue({});

    await POST(makeSignedRequest(makeSubscriptionEvent({ status: 'active', trial_end: 1699000000 })));
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: 'active' }) })
    );
  });

  it('skips update when business not found', async () => {
    mockBusinessFindUnique.mockResolvedValue(null);

    const res = await POST(makeSignedRequest(makeSubscriptionEvent()));
    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// checkout.session.completed (deal purchase)
// ---------------------------------------------------------------------------

describe('Stripe webhook — checkout.session.completed (deal purchase)', () => {
  const mockFinalize = finalizeDealPurchaseFromCheckoutSession as ReturnType<typeof vi.fn>;

  function makeDealPurchaseSessionEvent(overrides: Record<string, unknown> = {}) {
    return {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_abc',
          metadata: { kind: 'deal_purchase', dealPurchaseId: 'purchase-1', dealId: 'deal-1', businessId: 'biz-1' },
          payment_intent: 'pi_test_123',
          customer_details: { email: 'customer@test.com' },
          ...overrides,
        },
      },
    };
  }

  beforeEach(() => {
    mockFinalize.mockResolvedValue({ id: 'purchase-1', redemptionCode: 'ABCD1234' });
  });

  it('calls finalizeDealPurchaseFromCheckoutSession when dealPurchaseId is in metadata', async () => {
    const res = await POST(makeSignedRequest(makeDealPurchaseSessionEvent()));
    expect(res.status).toBe(200);
    expect(mockFinalize).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cs_test_abc', metadata: expect.objectContaining({ dealPurchaseId: 'purchase-1' }) }),
      'https://clientific.net'
    );
  });

  it('does not update business subscription when dealPurchaseId is present', async () => {
    await POST(makeSignedRequest(makeDealPurchaseSessionEvent()));
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when finalize throws', async () => {
    mockFinalize.mockRejectedValue(new Error('DB failure'));
    const res = await POST(makeSignedRequest(makeDealPurchaseSessionEvent()));
    expect(res.status).toBe(500);
  });

  it('still handles subscription checkout.session.completed when dealPurchaseId is absent', async () => {
    const subscriptionSession = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_sub_abc',
          metadata: { businessId: 'biz-1', plan: 'pro' },
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    };
    mockBusinessFindUnique.mockResolvedValue(null);
    const mockStripeSubscriptionsRetrieve = stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>;
    mockStripeSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123', status: 'active', trial_end: null, current_period_end: 1700000000,
      items: { data: [{ price: { id: 'price_pro' } }] },
    });

    const res = await POST(makeSignedRequest(subscriptionSession));
    expect(res.status).toBe(200);
    expect(mockFinalize).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// payment_intent.succeeded (deal purchase)
// ---------------------------------------------------------------------------

describe('Stripe webhook — payment_intent.succeeded (deal purchase)', () => {
  const mockFinalizePI = finalizeDealPurchaseFromPaymentIntent as ReturnType<typeof vi.fn>;

  function makePaymentIntentEvent(metadata: Record<string, string> = {}) {
    return {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          metadata: { kind: 'deal_purchase', dealPurchaseId: 'purchase-1', ...metadata },
          status: 'succeeded',
        },
      },
    };
  }

  beforeEach(() => {
    mockFinalizePI.mockResolvedValue({ id: 'purchase-1', redemptionCode: 'ABCD1234' });
  });

  it('calls finalizeDealPurchaseFromPaymentIntent when kind is deal_purchase', async () => {
    const res = await POST(makeSignedRequest(makePaymentIntentEvent()));
    expect(res.status).toBe(200);
    expect(mockFinalizePI).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pi_test_123', metadata: expect.objectContaining({ dealPurchaseId: 'purchase-1' }) }),
      'https://clientific.net'
    );
  });

  it('does not call finalizeDealPurchaseFromPaymentIntent when kind is absent (subscription PaymentIntent)', async () => {
    const res = await POST(makeSignedRequest(makePaymentIntentEvent({ kind: '' })));
    expect(res.status).toBe(200);
    expect(mockFinalizePI).not.toHaveBeenCalled();
  });

  it('does not touch business subscription tables for deal purchase payment intents', async () => {
    await POST(makeSignedRequest(makePaymentIntentEvent()));
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when finalize throws', async () => {
    mockFinalizePI.mockRejectedValue(new Error('DB failure'));
    const res = await POST(makeSignedRequest(makePaymentIntentEvent()));
    expect(res.status).toBe(500);
  });

  it('existing checkout.session.completed deal purchase path still works alongside', async () => {
    const mockFinalizeCS = finalizeDealPurchaseFromCheckoutSession as ReturnType<typeof vi.fn>;
    mockFinalizeCS.mockResolvedValue({ id: 'purchase-1' });

    const res = await POST(makeSignedRequest({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test', metadata: { dealPurchaseId: 'purchase-1' }, payment_intent: 'pi_test', customer_details: {} } },
    }));
    expect(res.status).toBe(200);
    expect(mockFinalizeCS).toHaveBeenCalled();
    expect(mockFinalizePI).not.toHaveBeenCalled();
  });
});
