import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dealPurchase: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    dealRedemption: {
      findUnique: vi.fn(),
    },
    deal: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    customer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: { retrieve: vi.fn() },
  },
}));

vi.mock('@/lib/twilio', () => ({
  sendSMS: vi.fn(),
  formatPhoneNumber: vi.fn((phone: string) => phone),
  formatDealPurchaseConfirmationSMS: vi.fn(() => 'Your code is ABCD1234'),
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { sendSMS } from '@/lib/twilio';
import { finalizeDealPurchaseFromPaymentIntent } from './deal-purchases';

const mockFindUnique = prisma.dealPurchase.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.dealPurchase.update as ReturnType<typeof vi.fn>;
const mockDealUpdate = prisma.deal.update as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const mockPaymentIntentRetrieve = stripe.paymentIntents.retrieve as ReturnType<typeof vi.fn>;
const mockSendSMS = sendSMS as ReturnType<typeof vi.fn>;

const basePaymentIntent = {
  id: 'pi_test_123',
  metadata: { kind: 'deal_purchase', dealPurchaseId: 'purchase-1' },
};

const basePurchase = {
  id: 'purchase-1',
  token: 'tok_abc',
  status: 'pending',
  redemptionCode: null,
  customerPhone: '+15551234567',
  customerName: 'Jane Doe',
  customerEmail: null,
  stripeReceiptUrl: null,
  dealId: 'deal-1',
  deal: { id: 'deal-1', title: 'Spring Special', businessId: 'biz-1' },
  business: { name: 'Test Salon', vapiPhoneNumber: null },
};

const finalizedPurchase = {
  ...basePurchase,
  status: 'paid',
  redemptionCode: 'ABCD1234',
  stripePaymentIntentId: 'pi_test_123',
  stripeReceiptUrl: 'https://clientific.net/deal-purchases/tok_abc',
};

function setupHappyPath() {
  // Return basePurchase for the initial lookup by id; return null for code-uniqueness checks
  mockFindUnique.mockImplementation(({ where }: any) => {
    if (where.id) return Promise.resolve(basePurchase);
    return Promise.resolve(null); // redemptionCode uniqueness check → null means "code is free"
  });
  (prisma.dealRedemption.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  mockPaymentIntentRetrieve.mockResolvedValue({
    latest_charge: { id: 'ch_123', receipt_url: 'https://stripe.com/receipt' },
  });
  mockTransaction.mockImplementation(async (fn: any) => {
    const txFindUnique = vi.fn().mockResolvedValue({ id: 'purchase-1', status: 'pending', redemptionCode: null, dealId: 'deal-1' });
    const txUpdate = vi.fn().mockResolvedValue(finalizedPurchase);
    const txDealUpdate = vi.fn().mockResolvedValue({});
    return fn({ dealPurchase: { findUnique: txFindUnique, update: txUpdate }, deal: { update: txDealUpdate } });
  });
  mockUpdate.mockResolvedValue({});
  mockSendSMS.mockResolvedValue({ success: true, messageId: 'SM123' });
}

describe('finalizeDealPurchaseFromPaymentIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when dealPurchaseId is missing from metadata', async () => {
    const result = await finalizeDealPurchaseFromPaymentIntent(
      { id: 'pi_test', metadata: {} } as any,
      'https://clientific.net'
    );
    expect(result).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('throws when the DealPurchase record is not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(
      finalizeDealPurchaseFromPaymentIntent(basePaymentIntent as any, 'https://clientific.net')
    ).rejects.toThrow('Deal purchase purchase-1 not found');
  });

  it('returns early without DB writes when purchase is already paid with a code', async () => {
    mockFindUnique.mockResolvedValue({ ...basePurchase, status: 'paid', redemptionCode: 'EXISTING' });
    const result = await finalizeDealPurchaseFromPaymentIntent(basePaymentIntent as any, 'https://clientific.net');
    expect(result?.redemptionCode).toBe('EXISTING');
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it('sets stripePaymentIntentId (not stripeCheckoutSessionId) on the purchase', async () => {
    setupHappyPath();
    await finalizeDealPurchaseFromPaymentIntent(basePaymentIntent as any, 'https://clientific.net');

    const txUpdateCall = (mockTransaction.mock.calls[0][0] as any);
    // verify the update data inside the transaction does not touch stripeCheckoutSessionId
    // we simulate by calling the transaction function and inspecting the mock calls
    const txMock = { dealPurchase: { findUnique: vi.fn().mockResolvedValue({ id: 'purchase-1', status: 'pending', redemptionCode: null, dealId: 'deal-1' }), update: vi.fn().mockResolvedValue(finalizedPurchase) }, deal: { update: vi.fn().mockResolvedValue({}) } };
    await txUpdateCall(txMock);
    const updateData = txMock.dealPurchase.update.mock.calls[0][0].data;
    expect(updateData).toHaveProperty('stripePaymentIntentId', 'pi_test_123');
    expect(updateData).not.toHaveProperty('stripeCheckoutSessionId');
  });

  it('increments deal.redemptionCount when the purchase was not previously paid', async () => {
    setupHappyPath();
    await finalizeDealPurchaseFromPaymentIntent(basePaymentIntent as any, 'https://clientific.net');

    const txUpdateCall = mockTransaction.mock.calls[0][0] as any;
    const txMock = { dealPurchase: { findUnique: vi.fn().mockResolvedValue({ id: 'purchase-1', status: 'pending', redemptionCode: null, dealId: 'deal-1' }), update: vi.fn().mockResolvedValue(finalizedPurchase) }, deal: { update: vi.fn().mockResolvedValue({}) } };
    await txUpdateCall(txMock);
    expect(txMock.deal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { redemptionCount: { increment: 1 } } })
    );
  });

  it('does not increment deal.redemptionCount on a second call (idempotency)', async () => {
    setupHappyPath();
    await finalizeDealPurchaseFromPaymentIntent(basePaymentIntent as any, 'https://clientific.net');

    const txUpdateCall = mockTransaction.mock.calls[0][0] as any;
    const txMock = { dealPurchase: { findUnique: vi.fn().mockResolvedValue({ id: 'purchase-1', status: 'paid', redemptionCode: 'ABCD1234', dealId: 'deal-1' }), update: vi.fn().mockResolvedValue(finalizedPurchase) }, deal: { update: vi.fn().mockResolvedValue({}) } };
    await txUpdateCall(txMock);
    expect(txMock.deal.update).not.toHaveBeenCalled();
  });

  it('sends the confirmation SMS after finalizing', async () => {
    setupHappyPath();
    await finalizeDealPurchaseFromPaymentIntent(basePaymentIntent as any, 'https://clientific.net');
    expect(mockSendSMS).toHaveBeenCalledTimes(1);
  });

  it('records SMS error but does not throw when SMS fails', async () => {
    setupHappyPath();
    mockSendSMS.mockResolvedValue({ success: false, error: 'Twilio error' });
    await expect(
      finalizeDealPurchaseFromPaymentIntent(basePaymentIntent as any, 'https://clientific.net')
    ).resolves.not.toThrow();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ smsConfirmationError: 'Twilio error' }) })
    );
  });
});
