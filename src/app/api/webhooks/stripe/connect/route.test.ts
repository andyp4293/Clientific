import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

const testStripe = new Stripe('sk_test_placeholder_key_for_build', {
  apiVersion: '2024-12-18.acacia' as any,
});

const TEST_SECRET = 'whsec_connect_testsigningsecret123';

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/lib/stripe-connect', () => ({
  syncBusinessConnectAccount: vi.fn(),
}));

vi.mock('@/lib/stripe', async () => {
  const { default: StripeClass } = await import('stripe');
  const real = new StripeClass('sk_test_placeholder_key_for_build', {
    apiVersion: '2024-12-18.acacia' as any,
  });

  return {
    stripe: {
      webhooks: real.webhooks,
    },
  };
});

import { syncBusinessConnectAccount } from '@/lib/stripe-connect';
import { POST } from './route';

const mockSyncBusinessConnectAccount = syncBusinessConnectAccount as ReturnType<typeof vi.fn>;

function makeSignedRequest(event: object, signingSecret = TEST_SECRET) {
  const body = JSON.stringify(event);
  const signature = testStripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: signingSecret,
  });

  return new NextRequest('http://localhost/api/webhooks/stripe/connect', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
  });
}

describe('POST /api/webhooks/stripe/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  });

  it('returns 400 when the signature header is missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe/connect', {
      method: 'POST',
      body: '{}',
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 when the signature is invalid', async () => {
    const res = await POST(
      makeSignedRequest(
        {
          type: 'account.updated',
          data: { object: { id: 'acct_123', metadata: { businessId: 'biz-1' } } },
        },
        'whsec_wrong_secret'
      )
    );

    expect(res.status).toBe(400);
  });

  it('trims the webhook secret and syncs the business on account.updated', async () => {
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = `${TEST_SECRET}\n`;

    const res = await POST(
      makeSignedRequest({
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_123',
            object: 'account',
            metadata: { businessId: 'biz-1' },
          },
        },
      })
    );

    expect(res.status).toBe(200);
    expect(mockSyncBusinessConnectAccount).toHaveBeenCalledWith(
      'biz-1',
      expect.objectContaining({
        id: 'acct_123',
      })
    );
  });

  it('ignores account.updated events without a businessId', async () => {
    const res = await POST(
      makeSignedRequest({
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_123',
            object: 'account',
            metadata: {},
          },
        },
      })
    );

    expect(res.status).toBe(200);
    expect(mockSyncBusinessConnectAccount).not.toHaveBeenCalled();
  });
});
