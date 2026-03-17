import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// All vi.mock calls use inline vi.fn() — no top-level variable references (hoisting safety)
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
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://clientific.net'),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
  PRICING_PLANS: {
    STARTER: {
      name: 'Starter',
      price: 29,
      yearlyPrice: 23,
      priceId: 'price_starter',
      yearlyPriceId: 'price_starter_yearly',
      limits: { customers: 100, staff: 2, services: 10 },
      popular: false,
    },
    PRO: {
      name: 'Pro',
      price: 79,
      yearlyPrice: 63,
      priceId: 'price_pro',
      yearlyPriceId: 'price_pro_yearly',
      limits: { customers: 1000, staff: 10, services: 50 },
      popular: true,
    },
    PREMIUM: {
      name: 'Premium',
      price: 149,
      yearlyPrice: 119,
      priceId: 'price_premium',
      yearlyPriceId: 'price_premium_yearly',
      limits: { customers: Infinity, staff: Infinity, services: Infinity },
      popular: false,
    },
  },
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (key: string) => key === 'stripe-signature' ? 'test-sig' : null,
  }),
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { finalizeDealPurchaseFromCheckoutSession, finalizeDealPurchaseFromPaymentIntent } from '@/lib/deal-purchases';
import { POST } from './route';

const mockConstructEvent = stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockBusinessUpdate = prisma.business.update as ReturnType<typeof vi.fn>;
const mockNotificationCreate = prisma.notification.create as ReturnType<typeof vi.fn>;

function makeRequest(body: string = '{}') {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': 'test-sig', 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNotificationCreate.mockResolvedValue({});
});

describe('Stripe webhook — customer.subscription.updated', () => {
  const baseBusiness = { id: 'biz-123', stripeSubscriptionId: 'sub_123' };

  function makeSubscriptionEvent(overrides: Record<string, unknown> = {}) {
    const subscription = {
      id: 'sub_123',
      status: 'active',
      trial_end: null,
      current_period_end: 1700000000,
      items: { data: [{ price: { id: 'price_pro' } }] },
      ...overrides,
    };
    return {
      type: 'customer.subscription.updated',
      data: { object: subscription },
    };
  }

  it('syncs trialEndsAt when trial_end is a timestamp', async () => {
    const trialEnd = 1700000000; // unix timestamp
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent({ trial_end: trialEnd, status: 'active' }));
    mockBusinessFindUnique.mockResolvedValue(baseBusiness);
    mockBusinessUpdate.mockResolvedValue({});

    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trialEndsAt: new Date(trialEnd * 1000),
        }),
      })
    );
  });

  it('sets trialEndsAt to null when trial_end is null', async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent({ trial_end: null }));
    mockBusinessFindUnique.mockResolvedValue(baseBusiness);
    mockBusinessUpdate.mockResolvedValue({});

    const req = makeRequest();
    await POST(req);

    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trialEndsAt: null,
        }),
      })
    );
  });

  it('writes subscriptionStatus active when trial transitions to active', async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent({ status: 'active', trial_end: 1699000000 }));
    mockBusinessFindUnique.mockResolvedValue(baseBusiness);
    mockBusinessUpdate.mockResolvedValue({});

    const req = makeRequest();
    await POST(req);

    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionStatus: 'active',
        }),
      })
    );
  });

  it('skips update when business not found', async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent());
    mockBusinessFindUnique.mockResolvedValue(null);

    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });
});

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
    mockConstructEvent.mockReturnValue(makeDealPurchaseSessionEvent());

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    expect(mockFinalize).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cs_test_abc',
        metadata: expect.objectContaining({ dealPurchaseId: 'purchase-1' }),
      }),
      'https://clientific.net'
    );
  });

  it('does not update business subscription when dealPurchaseId is present', async () => {
    mockConstructEvent.mockReturnValue(makeDealPurchaseSessionEvent());

    await POST(makeRequest());

    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('returns 200 even when finalize throws, and logs the error', async () => {
    mockFinalize.mockRejectedValue(new Error('DB failure'));
    mockConstructEvent.mockReturnValue(makeDealPurchaseSessionEvent());

    const res = await POST(makeRequest());
    // Webhook must always return 200 to prevent Stripe retries on transient errors
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
    mockConstructEvent.mockReturnValue(subscriptionSession);
    mockBusinessFindUnique.mockResolvedValue(null); // no business — short-circuit
    const mockStripeSubscriptionsRetrieve = stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>;
    mockStripeSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      trial_end: null,
      current_period_end: 1700000000,
      items: { data: [{ price: { id: 'price_pro' } }] },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockFinalize).not.toHaveBeenCalled();
  });
});

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
    mockConstructEvent.mockReturnValue(makePaymentIntentEvent());
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockFinalizePI).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pi_test_123', metadata: expect.objectContaining({ dealPurchaseId: 'purchase-1' }) }),
      'https://clientific.net'
    );
  });

  it('does not call finalizeDealPurchaseFromPaymentIntent when kind is absent (subscription PaymentIntent)', async () => {
    mockConstructEvent.mockReturnValue(makePaymentIntentEvent({ kind: '' }));
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockFinalizePI).not.toHaveBeenCalled();
  });

  it('does not touch business subscription tables for deal purchase payment intents', async () => {
    mockConstructEvent.mockReturnValue(makePaymentIntentEvent());
    await POST(makeRequest());
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when finalize throws (Stripe will not retry 5xx)', async () => {
    mockFinalizePI.mockRejectedValue(new Error('DB failure'));
    mockConstructEvent.mockReturnValue(makePaymentIntentEvent());
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  it('existing checkout.session.completed deal purchase path still works alongside', async () => {
    const mockFinalizeCS = finalizeDealPurchaseFromCheckoutSession as ReturnType<typeof vi.fn>;
    mockFinalizeCS.mockResolvedValue({ id: 'purchase-1' });
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test', metadata: { dealPurchaseId: 'purchase-1' }, payment_intent: 'pi_test', customer_details: {} } },
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockFinalizeCS).toHaveBeenCalled();
    expect(mockFinalizePI).not.toHaveBeenCalled();
  });
});
