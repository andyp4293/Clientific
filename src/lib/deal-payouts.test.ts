import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dealPurchase: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    business: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      retrieve: vi.fn(),
    },
    charges: {
      retrieve: vi.fn(),
    },
    transfers: {
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  canAutoTransferDealPayouts,
  emptyDealPayoutSummary,
  getDealPayoutSummary,
  retryPendingDealPurchaseTransfers,
  settlePendingDealPurchasePayouts,
  syncDealPurchasePayoutTracking,
} from './deal-payouts';

const mockFindUnique = prisma.dealPurchase.findUnique as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.dealPurchase.findMany as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.dealPurchase.update as ReturnType<typeof vi.fn>;
const mockBusinessFindMany = prisma.business.findMany as ReturnType<typeof vi.fn>;
const mockRetrievePaymentIntent = stripe.paymentIntents.retrieve as ReturnType<typeof vi.fn>;
const mockRetrieveCharge = stripe.charges.retrieve as ReturnType<typeof vi.fn>;
const mockListTransfers = stripe.transfers.list as ReturnType<typeof vi.fn>;
const mockCreateTransfer = stripe.transfers.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
  mockBusinessFindMany.mockResolvedValue([]);
  mockListTransfers.mockResolvedValue({
    data: [],
    has_more: false,
  });
  mockCreateTransfer.mockResolvedValue({ id: 'tr_123' });
});

describe('syncDealPurchasePayoutTracking', () => {
  it('marks a purchase automatic when Stripe already routed it to the connected account', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'purchase_1',
      stripeChargeId: null,
      stripePaymentIntentId: 'pi_123',
      businessNetAmount: 128,
      payoutTransferStatus: null,
      payoutTransferredAt: null,
    });
    mockRetrievePaymentIntent.mockResolvedValue({
      id: 'pi_123',
      latest_charge: 'ch_123',
      transfer_data: {
        destination: 'acct_123',
      },
    });

    await syncDealPurchasePayoutTracking({ purchaseId: 'purchase_1' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'purchase_1' },
      data: {
        stripeChargeId: 'ch_123',
        payoutTransferStatus: 'automatic',
        payoutTransferredAt: expect.any(Date),
        payoutTransferFailureReason: null,
      },
    });
  });
});

describe('settlePendingDealPurchasePayouts', () => {
  it('creates a transfer for an older deal purchase that never reached the connected account', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'purchase_1',
        stripePaymentIntentId: 'pi_123',
        stripeChargeId: 'ch_123',
        businessNetAmount: 128,
        currency: 'usd',
        payoutTransferStatus: null,
        payoutTransferredAt: null,
      },
    ]);
    mockRetrievePaymentIntent.mockResolvedValue({
      id: 'pi_123',
      latest_charge: 'ch_123',
      transfer_data: null,
    });

    const result = await settlePendingDealPurchasePayouts({
      businessId: 'biz_1',
      connectAccountId: 'acct_123',
    });

    expect(mockCreateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 128,
        currency: 'usd',
        destination: 'acct_123',
        source_transaction: 'ch_123',
        metadata: expect.objectContaining({
          dealPurchaseId: 'purchase_1',
          businessId: 'biz_1',
          payoutOrigin: 'deal_purchase_backfill',
        }),
      }),
      { idempotencyKey: 'deal-payout-purchase_1' }
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'purchase_1' },
      data: {
        stripeChargeId: 'ch_123',
        stripeTransferId: 'tr_123',
        payoutTransferStatus: 'transferred',
        payoutTransferredAt: expect.any(Date),
        payoutTransferFailureReason: null,
      },
    });
    expect(result).toEqual({
      transferredAmount: 128,
      transferredCount: 1,
      automaticCount: 0,
      failedCount: 0,
    });
  });

  it('detects automatic destination payouts and does not create a duplicate transfer', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'purchase_1',
        stripePaymentIntentId: 'pi_123',
        stripeChargeId: 'ch_123',
        businessNetAmount: 128,
        currency: 'usd',
        payoutTransferStatus: null,
        payoutTransferredAt: null,
      },
    ]);
    mockRetrievePaymentIntent.mockResolvedValue({
      id: 'pi_123',
      latest_charge: 'ch_123',
      transfer_data: {
        destination: 'acct_123',
      },
    });

    const result = await settlePendingDealPurchasePayouts({
      businessId: 'biz_1',
      connectAccountId: 'acct_123',
    });

    expect(mockCreateTransfer).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'purchase_1' },
      data: {
        stripeChargeId: 'ch_123',
        payoutTransferStatus: 'automatic',
        payoutTransferredAt: expect.any(Date),
        payoutTransferFailureReason: null,
      },
    });
    expect(result).toEqual({
      transferredAmount: 0,
      transferredCount: 0,
      automaticCount: 1,
      failedCount: 0,
    });
  });

  it('reconciles an existing Stripe transfer without creating a second one', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'purchase_1',
        stripePaymentIntentId: 'pi_123',
        stripeChargeId: 'ch_123',
        businessNetAmount: 128,
        currency: 'usd',
        payoutTransferStatus: null,
        payoutTransferredAt: null,
      },
    ]);
    mockRetrievePaymentIntent.mockResolvedValue({
      id: 'pi_123',
      latest_charge: 'ch_123',
      transfer_data: null,
    });
    mockListTransfers.mockResolvedValue({
      data: [
        {
          id: 'tr_existing',
          source_transaction: 'ch_123',
          created: 1711123200,
        },
      ],
      has_more: false,
    });

    const result = await settlePendingDealPurchasePayouts({
      businessId: 'biz_1',
      connectAccountId: 'acct_123',
    });

    expect(mockCreateTransfer).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'purchase_1' },
      data: {
        stripeChargeId: 'ch_123',
        stripeTransferId: 'tr_existing',
        payoutTransferStatus: 'transferred',
        payoutTransferredAt: new Date(1711123200 * 1000),
        payoutTransferFailureReason: null,
      },
    });
    expect(result).toEqual({
      transferredAmount: 128,
      transferredCount: 1,
      automaticCount: 0,
      failedCount: 0,
    });
  });
});

describe('getDealPayoutSummary', () => {
  it('returns zeroes when there are no paid deal purchases', async () => {
    mockFindMany.mockResolvedValue([]);

    await expect(getDealPayoutSummary('biz_1')).resolves.toEqual(
      emptyDealPayoutSummary()
    );
  });

  it('splits pending, transferred, and automatic deal earnings', async () => {
    mockFindMany.mockResolvedValue([
      {
        businessNetAmount: 128,
        payoutTransferStatus: null,
        payoutTransferredAt: null,
      },
      {
        businessNetAmount: 256,
        payoutTransferStatus: 'transferred',
        payoutTransferredAt: new Date('2026-03-22T18:00:00.000Z'),
      },
      {
        businessNetAmount: 512,
        payoutTransferStatus: 'automatic',
        payoutTransferredAt: new Date('2026-03-23T18:00:00.000Z'),
      },
    ]);

    await expect(getDealPayoutSummary('biz_1')).resolves.toEqual({
      lifetimeEarned: 896,
      pendingTransfer: 128,
      transferredToConnect: 768,
      pendingCount: 1,
      transferredCount: 2,
      automaticCount: 1,
      lastTransferredAt: '2026-03-23T18:00:00.000Z',
    });
  });
});

describe('retryPendingDealPurchaseTransfers', () => {
  it('retries backfills for every payout-ready business with pending deal earnings', async () => {
    mockBusinessFindMany.mockResolvedValue([
      { id: 'biz_1', stripeConnectAccountId: 'acct_123' },
      { id: 'biz_2', stripeConnectAccountId: 'acct_456' },
    ]);
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: 'purchase_1',
          stripePaymentIntentId: 'pi_123',
          stripeChargeId: 'ch_123',
          businessNetAmount: 128,
          currency: 'usd',
          payoutTransferStatus: null,
          payoutTransferredAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'purchase_2',
          stripePaymentIntentId: 'pi_456',
          stripeChargeId: 'ch_456',
          businessNetAmount: 256,
          currency: 'usd',
          payoutTransferStatus: null,
          payoutTransferredAt: null,
        },
      ]);
    mockRetrievePaymentIntent
      .mockResolvedValueOnce({
        id: 'pi_123',
        latest_charge: 'ch_123',
        transfer_data: null,
      })
      .mockResolvedValueOnce({
        id: 'pi_456',
        latest_charge: 'ch_456',
        transfer_data: {
          destination: 'acct_456',
        },
      });

    const result = await retryPendingDealPurchaseTransfers();

    expect(mockBusinessFindMany).toHaveBeenCalledWith({
      where: {
        stripeConnectAccountId: {
          not: null,
        },
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectDetailsSubmitted: true,
        dealPurchases: {
          some: {
            status: {
              in: ['paid', 'redeemed'],
            },
            businessNetAmount: {
              gt: 0,
            },
            OR: [
              { payoutTransferStatus: null },
              { payoutTransferStatus: 'pending' },
              { payoutTransferStatus: 'failed' },
            ],
          },
        },
      },
      select: {
        id: true,
        stripeConnectAccountId: true,
      },
    });
    expect(result).toEqual({
      eligibleBusinesses: 2,
      transferredAmount: 128,
      transferredCount: 1,
      automaticCount: 1,
      failedCount: 0,
    });
  });
});

describe('canAutoTransferDealPayouts', () => {
  it('requires a fully ready connected payout account', () => {
    expect(
      canAutoTransferDealPayouts({
        stripeConnectAccountId: 'acct_123',
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectDetailsSubmitted: true,
      })
    ).toBe(true);

    expect(
      canAutoTransferDealPayouts({
        stripeConnectAccountId: 'acct_123',
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: false,
        stripeConnectDetailsSubmitted: true,
      })
    ).toBe(false);
  });
});
