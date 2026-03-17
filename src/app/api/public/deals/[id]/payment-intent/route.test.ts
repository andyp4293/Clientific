import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    deal: { findUnique: vi.fn() },
    dealPurchase: { update: vi.fn() },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: { create: vi.fn() },
  },
}));

vi.mock('@/lib/deal-purchase-pricing', () => ({
  DealPurchasePricingError: class DealPurchasePricingError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DealPurchasePricingError';
    }
  },
  getSelectableServicesForDeal: vi.fn(),
  resolveSelectedServicesForDeal: vi.fn(),
  calculateDealPurchaseTotals: vi.fn(),
}));

vi.mock('@/lib/deal-purchases', () => ({
  createPendingDealPurchase: vi.fn(),
  finalizeDealPurchaseFromPaymentIntent: vi.fn(),
}));

vi.mock('@/lib/stripe-connect', () => ({
  ensureBusinessConnectAccount: vi.fn(),
}));

vi.mock('@/lib/twilio', () => ({
  formatPhoneNumber: vi.fn((phone: string) => phone),
  isValidPhoneNumber: vi.fn(() => true),
}));

vi.mock('@/lib/app-url', () => ({
  getAppBaseUrlFromRequest: vi.fn(() => 'https://clientific.net'),
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  getSelectableServicesForDeal,
  resolveSelectedServicesForDeal,
  calculateDealPurchaseTotals,
  DealPurchasePricingError,
} from '@/lib/deal-purchase-pricing';
import { createPendingDealPurchase, finalizeDealPurchaseFromPaymentIntent } from '@/lib/deal-purchases';
import { ensureBusinessConnectAccount } from '@/lib/stripe-connect';
import { isValidPhoneNumber } from '@/lib/twilio';
import { POST } from './route';

const mockDealFindUnique = prisma.deal.findUnique as ReturnType<typeof vi.fn>;
const mockDealPurchaseUpdate = prisma.dealPurchase.update as ReturnType<typeof vi.fn>;
const mockPaymentIntentCreate = stripe.paymentIntents.create as ReturnType<typeof vi.fn>;
const mockCreatePending = createPendingDealPurchase as ReturnType<typeof vi.fn>;
const mockFinalize = finalizeDealPurchaseFromPaymentIntent as ReturnType<typeof vi.fn>;
const mockEnsureConnect = ensureBusinessConnectAccount as ReturnType<typeof vi.fn>;
const mockIsValidPhone = isValidPhoneNumber as ReturnType<typeof vi.fn>;
const mockGetSelectable = getSelectableServicesForDeal as ReturnType<typeof vi.fn>;
const mockResolveSelected = resolveSelectedServicesForDeal as ReturnType<typeof vi.fn>;
const mockCalculateTotals = calculateDealPurchaseTotals as ReturnType<typeof vi.fn>;

const now = Date.now();

const baseDeal = {
  id: 'deal-1',
  active: true,
  deliveryType: 'purchase_link',
  serviceScope: 'all_services',
  discountType: 'percent_off',
  discountValue: 20,
  startsAt: new Date(now - 86400_000),
  expiresAt: new Date(now + 86400_000),
  maxRedemptions: null,
  redemptionCount: 0,
  platformFeePercent: 15,
  businessId: 'biz-1',
  eligibleServices: [],
  business: {
    id: 'biz-1',
    name: 'Test Salon',
    email: 'salon@test.com',
    slug: 'test-salon',
    stripeConnectAccountId: 'acct_123',
    services: [{ id: 'svc-1', name: 'Haircut', price: 50, active: true }],
  },
};

const basePurchase = {
  id: 'purchase-1',
  token: 'tok_abc',
  applicationFeeAmount: 600,
  customer: { email: 'customer@test.com' },
};

const readyConnectAccount = {
  id: 'acct_123',
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
};

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/public/deals/deal-1/payment-intent', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDealFindUnique.mockResolvedValue(baseDeal);
  mockIsValidPhone.mockReturnValue(true);
  mockGetSelectable.mockReturnValue([{ id: 'svc-1', name: 'Haircut', price: 50, active: true }]);
  mockResolveSelected.mockReturnValue([{ id: 'svc-1', name: 'Haircut', price: 50, active: true }]);
  mockCalculateTotals.mockReturnValue({ subtotalAmount: 5000, discountAmount: 1000, totalAmount: 4000, items: [] });
  mockCreatePending.mockResolvedValue(basePurchase);
  mockEnsureConnect.mockResolvedValue(readyConnectAccount);
  mockPaymentIntentCreate.mockResolvedValue({ id: 'pi_test_123', client_secret: 'pi_test_123_secret_abc' });
  mockDealPurchaseUpdate.mockResolvedValue({});
});

describe('POST /api/public/deals/[id]/payment-intent', () => {
  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({ customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/name and phone/i);
  });

  it('returns 400 when phone is missing', async () => {
    const res = await POST(makeRequest({ customerName: 'Jane', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/name and phone/i);
  });

  it('returns 400 when phone is invalid', async () => {
    mockIsValidPhone.mockReturnValue(false);
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: 'bad', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid phone/i);
  });

  it('returns 404 when deal is not found or inactive', async () => {
    mockDealFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 when deal is code_claim type', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, deliveryType: 'code_claim' });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when deal has not started', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, startsAt: new Date(now + 86400_000) });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not currently active/i);
  });

  it('returns 400 when deal has expired', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, expiresAt: new Date(now - 1000) });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not currently active/i);
  });

  it('returns 400 when deal is sold out', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, maxRedemptions: 5, redemptionCount: 5 });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/sold out/i);
  });

  it('returns 400 when pricing validation fails', async () => {
    mockResolveSelected.mockImplementation(() => {
      throw new DealPurchasePricingError('One or more selected services are not eligible for this deal');
    });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['bad'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/eligible/i);
  });

  it('returns 409 when business Connect account is not ready', async () => {
    mockEnsureConnect.mockResolvedValue({ ...readyConnectAccount, charges_enabled: false });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/not ready/i);
  });

  it('creates a PaymentIntent with Connect transfer and returns clientSecret + token', async () => {
    const res = await POST(makeRequest({ customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clientSecret).toBe('pi_test_123_secret_abc');
    expect(body.purchaseId).toBe('purchase-1');
    expect(body.purchaseToken).toBe('tok_abc');

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4000,
        currency: 'usd',
        application_fee_amount: basePurchase.applicationFeeAmount,
        transfer_data: { destination: readyConnectAccount.id },
        metadata: expect.objectContaining({ kind: 'deal_purchase', dealPurchaseId: 'purchase-1' }),
      })
    );
  });

  it('uses automatic_payment_methods so Apple Pay and Google Pay are enabled', async () => {
    await POST(makeRequest({ customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    const callArg = mockPaymentIntentCreate.mock.calls[0][0];
    expect(callArg.automatic_payment_methods).toEqual({ enabled: true });
    expect(callArg).not.toHaveProperty('payment_method_types');
  });

  it('stores the PaymentIntent id on the DealPurchase record', async () => {
    await POST(makeRequest({ customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(mockDealPurchaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripePaymentIntentId: 'pi_test_123' } })
    );
  });

  it('returns 500 when stripe.paymentIntents.create throws', async () => {
    mockPaymentIntentCreate.mockRejectedValue(new Error('Stripe error'));
    const res = await POST(makeRequest({ customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/failed to start checkout/i);
  });

  it('finalizes free deal immediately without creating a PaymentIntent', async () => {
    mockCalculateTotals.mockReturnValue({ subtotalAmount: 5000, discountAmount: 5000, totalAmount: 0, items: [] });
    mockFinalize.mockResolvedValue({ id: 'purchase-1' });

    const res = await POST(makeRequest({ customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.immediate).toBe(true);
    expect(body.url).toContain('/deal-purchases/tok_abc');
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled();
    expect(mockFinalize).toHaveBeenCalled();
  });
});
