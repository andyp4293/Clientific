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
