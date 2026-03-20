import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    referralCommission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    referral: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    business: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    invoices: {
      list: vi.fn(),
    },
    transfers: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  canAutoTransferReferralPayouts,
  DEFAULT_REFERRAL_RECONCILIATION_LOOKBACK_DAYS,
  emptyReferralPayoutSummary,
  getReferralPayoutSummary,
  recordReferralCommission,
  reconcileReferralCommissions,
  retryPendingReferralTransfers,
  settlePendingReferralCommissions,
} from './referral-payouts';

const mockFindUnique = prisma.referralCommission.findUnique as ReturnType<typeof vi.fn>;
const mockCreate = prisma.referralCommission.create as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.referralCommission.findMany as ReturnType<typeof vi.fn>;
const mockUpdateCommission = prisma.referralCommission.update as ReturnType<typeof vi.fn>;
const mockReferralFindMany = prisma.referral.findMany as ReturnType<typeof vi.fn>;
const mockUpdateReferral = prisma.referral.update as ReturnType<typeof vi.fn>;
const mockBusinessFindMany = prisma.business.findMany as ReturnType<typeof vi.fn>;
const mockUpdateBusiness = prisma.business.update as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const mockInvoiceList = stripe.invoices.list as ReturnType<typeof vi.fn>;
const mockTransferCreate = stripe.transfers.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'comm_1' });
  mockUpdateReferral.mockResolvedValue({});
  mockUpdateBusiness.mockResolvedValue({});
  mockUpdateCommission.mockResolvedValue({});
  mockReferralFindMany.mockResolvedValue([]);
  mockBusinessFindMany.mockResolvedValue([]);
  mockInvoiceList.mockResolvedValue({
    data: [],
    has_more: false,
  });
  mockTransferCreate.mockResolvedValue({ id: 'tr_123' });
  mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
});

describe('recordReferralCommission', () => {
  it('creates a recurring commission and increments referral totals once', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await recordReferralCommission({
      referralId: 'ref_1',
      referrerId: 'biz_1',
      stripeInvoiceId: 'inv_1',
      commissionCents: 870,
    });

    expect(result).toEqual({
      created: true,
      duplicate: false,
      amountCents: 870,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        referralId: 'ref_1',
        stripeInvoiceId: 'inv_1',
        amountDollars: 8.7,
      },
    });
    expect(mockUpdateReferral).toHaveBeenCalledWith({
      where: { id: 'ref_1' },
      data: {
        status: 'active',
        creditedAt: expect.any(Date),
        creditAmount: { increment: 8.7 },
      },
    });
    expect(mockUpdateBusiness).toHaveBeenCalledWith({
      where: { id: 'biz_1' },
      data: {
        referralCredits: { increment: 8.7 },
      },
    });
  });

  it('skips duplicate invoice ids without double-crediting', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'comm_existing',
      amountDollars: 8.7,
    });

    const result = await recordReferralCommission({
      referralId: 'ref_1',
      referrerId: 'biz_1',
      stripeInvoiceId: 'inv_1',
      commissionCents: 870,
    });

    expect(result).toEqual({
      created: false,
      duplicate: true,
      amountCents: 870,
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdateReferral).not.toHaveBeenCalled();
    expect(mockUpdateBusiness).not.toHaveBeenCalled();
  });
});

describe('settlePendingReferralCommissions', () => {
  it('moves pending commissions into the connected account balance', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'comm_1',
        stripeInvoiceId: 'inv_1',
        amountDollars: 8.7,
      },
      {
        id: 'comm_2',
        stripeInvoiceId: 'inv_2',
        amountDollars: 23.7,
      },
    ]);

    const result = await settlePendingReferralCommissions({
      businessId: 'biz_1',
      connectAccountId: 'acct_123',
    });

    expect(result).toEqual({
      transferredAmount: 3240,
      transferredCount: 2,
    });
    expect(mockTransferCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        amount: 870,
        destination: 'acct_123',
        metadata: expect.objectContaining({
          referralCommissionId: 'comm_1',
          referrerBusinessId: 'biz_1',
          stripeInvoiceId: 'inv_1',
        }),
      }),
      { idempotencyKey: 'referral-commission-comm_1' }
    );
    expect(mockUpdateCommission).toHaveBeenCalledWith({
      where: { id: 'comm_1' },
      data: {
        transferStatus: 'transferred',
        stripeTransferId: 'tr_123',
        transferredAt: expect.any(Date),
        transferFailureReason: null,
      },
    });
  });

  it('marks a commission failed when Stripe transfer creation fails', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'comm_1',
        stripeInvoiceId: 'inv_1',
        amountDollars: 8.7,
      },
    ]);
    mockTransferCreate.mockRejectedValue(new Error('Insufficient available balance'));

    const result = await settlePendingReferralCommissions({
      businessId: 'biz_1',
      connectAccountId: 'acct_123',
    });

    expect(result).toEqual({
      transferredAmount: 0,
      transferredCount: 0,
    });
    expect(mockUpdateCommission).toHaveBeenCalledWith({
      where: { id: 'comm_1' },
      data: {
        transferStatus: 'failed',
        transferFailureReason: 'Insufficient available balance',
      },
    });
  });
});

describe('getReferralPayoutSummary', () => {
  it('returns a zeroed summary when no commissions exist', async () => {
    mockFindMany.mockResolvedValue([]);

    await expect(getReferralPayoutSummary('biz_1')).resolves.toEqual(
      emptyReferralPayoutSummary()
    );
  });

  it('splits transferred and pending amounts for the payouts UI', async () => {
    mockFindMany.mockResolvedValue([
      {
        amountDollars: 8.7,
        transferStatus: 'transferred',
        transferredAt: new Date('2026-03-10T12:00:00.000Z'),
      },
      {
        amountDollars: 23.7,
        transferStatus: 'pending',
        transferredAt: null,
      },
      {
        amountDollars: 14.7,
        transferStatus: 'failed',
        transferredAt: null,
      },
    ]);

    await expect(getReferralPayoutSummary('biz_1')).resolves.toEqual({
      lifetimeEarned: 4710,
      pendingTransfer: 3840,
      transferredToConnect: 870,
      pendingCount: 2,
      transferredCount: 1,
      lastTransferredAt: '2026-03-10T12:00:00.000Z',
    });
  });
});

describe('reconcileReferralCommissions', () => {
  it('backfills missing commissions from paid subscription invoices', async () => {
    mockInvoiceList.mockResolvedValue({
      data: [
        {
          id: 'inv_1',
          customer: 'cus_referee',
          amount_paid: 2900,
          subscription: 'sub_123',
        },
      ],
      has_more: false,
    });
    mockReferralFindMany.mockResolvedValue([
      {
        id: 'ref_1',
        referrerId: 'biz_1',
        referee: {
          stripeCustomerId: 'cus_referee',
        },
      },
    ]);
    mockFindUnique.mockResolvedValue(null);

    const result = await reconcileReferralCommissions({ lookbackDays: 45 });

    expect(mockInvoiceList).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'paid',
        limit: 100,
      })
    );
    expect(result).toMatchObject({
      scannedInvoices: 1,
      matchedReferralInvoices: 1,
      createdCommissions: 1,
      duplicateInvoices: 0,
      skippedWithoutReferral: 0,
      skippedNonSubscription: 0,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        referralId: 'ref_1',
        stripeInvoiceId: 'inv_1',
        amountDollars: 8.7,
      },
    });
  });

  it('counts duplicates and ignores paid invoices without a matching referral', async () => {
    mockInvoiceList.mockResolvedValue({
      data: [
        {
          id: 'inv_duplicate',
          customer: 'cus_referee',
          amount_paid: 2900,
          subscription: 'sub_123',
        },
        {
          id: 'inv_other',
          customer: 'cus_other',
          amount_paid: 2900,
          subscription: 'sub_456',
        },
        {
          id: 'inv_non_subscription',
          customer: 'cus_referee',
          amount_paid: 2900,
          subscription: null,
        },
      ],
      has_more: false,
    });
    mockReferralFindMany.mockResolvedValue([
      {
        id: 'ref_1',
        referrerId: 'biz_1',
        referee: {
          stripeCustomerId: 'cus_referee',
        },
      },
    ]);
    mockFindUnique.mockResolvedValueOnce({
      id: 'existing_commission',
      amountDollars: 8.7,
    });

    const result = await reconcileReferralCommissions();

    expect(result.since).toBeTruthy();
    expect(result).toMatchObject({
      scannedInvoices: 3,
      matchedReferralInvoices: 1,
      createdCommissions: 0,
      duplicateInvoices: 1,
      skippedWithoutReferral: 1,
      skippedNonSubscription: 1,
    });
    expect(DEFAULT_REFERRAL_RECONCILIATION_LOOKBACK_DAYS).toBe(45);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('retryPendingReferralTransfers', () => {
  it('retries transfers for payout-ready businesses with pending commissions', async () => {
    mockBusinessFindMany.mockResolvedValue([
      {
        id: 'biz_1',
        stripeConnectAccountId: 'acct_123',
      },
      {
        id: 'biz_2',
        stripeConnectAccountId: 'acct_456',
      },
    ]);
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: 'comm_1',
          stripeInvoiceId: 'inv_1',
          amountDollars: 8.7,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'comm_2',
          stripeInvoiceId: 'inv_2',
          amountDollars: 23.7,
        },
      ]);
    mockTransferCreate
      .mockResolvedValueOnce({ id: 'tr_123' })
      .mockResolvedValueOnce({ id: 'tr_456' });

    const result = await retryPendingReferralTransfers();

    expect(mockBusinessFindMany).toHaveBeenCalledWith({
      where: {
        stripeConnectAccountId: {
          not: null,
        },
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectDetailsSubmitted: true,
        referralsMade: {
          some: {
            commissions: {
              some: {
                transferStatus: {
                  in: ['pending', 'failed'],
                },
              },
            },
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
      transferredAmount: 3240,
      transferredCount: 2,
    });
  });
});

describe('canAutoTransferReferralPayouts', () => {
  it('requires a fully ready connected account', () => {
    expect(
      canAutoTransferReferralPayouts({
        stripeConnectAccountId: 'acct_123',
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectDetailsSubmitted: true,
      })
    ).toBe(true);

    expect(
      canAutoTransferReferralPayouts({
        stripeConnectAccountId: 'acct_123',
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: false,
        stripeConnectDetailsSubmitted: true,
      })
    ).toBe(false);
  });
});
