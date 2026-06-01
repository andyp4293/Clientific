import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    deal: { findUnique: vi.fn() },
    dealPurchase: { update: vi.fn() },
    customer: { findFirst: vi.fn() },
    idempotencyRecord: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
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
  finalizeDealPurchaseFromCheckoutSession: vi.fn(),
}));

vi.mock('@/lib/stripe-connect', () => ({
  ensureBusinessConnectAccount: vi.fn(),
  isConnectAccountReady: vi.fn((account: { charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean }) =>
    Boolean(account?.charges_enabled && account?.payouts_enabled && account?.details_submitted)
  ),
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
import { createPendingDealPurchase, finalizeDealPurchaseFromCheckoutSession } from '@/lib/deal-purchases';
import {
  ensureBusinessConnectAccount,
  isConnectAccountReady,
} from '@/lib/stripe-connect';
import { isValidPhoneNumber } from '@/lib/twilio';
import { POST } from './route';

const mockDealFindUnique = prisma.deal.findUnique as ReturnType<typeof vi.fn>;
const mockDealPurchaseUpdate = prisma.dealPurchase.update as ReturnType<typeof vi.fn>;
const mockCustomerFindFirst = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockIdempotencyCreate = prisma.idempotencyRecord.create as ReturnType<typeof vi.fn>;
const mockIdempotencyFindUnique = prisma.idempotencyRecord.findUnique as ReturnType<typeof vi.fn>;
const mockIdempotencyUpdate = prisma.idempotencyRecord.update as ReturnType<typeof vi.fn>;
const mockSessionCreate = stripe.checkout.sessions.create as ReturnType<typeof vi.fn>;
const mockCreatePending = createPendingDealPurchase as ReturnType<typeof vi.fn>;
const mockFinalize = finalizeDealPurchaseFromCheckoutSession as ReturnType<typeof vi.fn>;
const mockEnsureConnect = ensureBusinessConnectAccount as ReturnType<typeof vi.fn>;
const mockIsConnectAccountReady = isConnectAccountReady as ReturnType<typeof vi.fn>;
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
  platformFeePercent: 10,
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
  applicationFeeAmount: 1500,
  customer: { email: 'customer@test.com' },
};

const readyConnectAccount = {
  id: 'acct_123',
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
};

const idempotencyRecords = new Map<string, any>();

function makeRequest(body: object, dealId = 'deal-1') {
  return new NextRequest(`http://localhost/api/public/deals/${dealId}/checkout`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  idempotencyRecords.clear();
  mockDealFindUnique.mockResolvedValue(baseDeal);
  mockIsValidPhone.mockReturnValue(true);
  mockGetSelectable.mockReturnValue([{ id: 'svc-1', name: 'Haircut', price: 50, active: true }]);
  mockResolveSelected.mockReturnValue([{ id: 'svc-1', name: 'Haircut', price: 50, active: true }]);
  mockCalculateTotals.mockReturnValue({ subtotalAmount: 5000, discountAmount: 1000, totalAmount: 4000, items: [] });
  mockCreatePending.mockResolvedValue(basePurchase);
  mockEnsureConnect.mockResolvedValue(readyConnectAccount);
  mockIsConnectAccountReady.mockImplementation((account: { charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean }) =>
    Boolean(account?.charges_enabled && account?.payouts_enabled && account?.details_submitted)
  );
  mockSessionCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' });
  mockDealPurchaseUpdate.mockResolvedValue({});
  mockCustomerFindFirst.mockResolvedValue(null);
  mockIdempotencyCreate.mockImplementation(async ({ data }: any) => {
    if (idempotencyRecords.has(data.key)) {
      throw { code: 'P2002' };
    }
    const record = {
      ...data,
      responseStatus: data.responseStatus ?? null,
      responseBody: data.responseBody ?? null,
    };
    idempotencyRecords.set(data.key, record);
    return record;
  });
  mockIdempotencyFindUnique.mockImplementation(async ({ where }: any) => {
    return idempotencyRecords.get(where.key) ?? null;
  });
  mockIdempotencyUpdate.mockImplementation(async ({ where, data }: any) => {
    const existing = idempotencyRecords.get(where.key);
    if (!existing) throw new Error(`Missing idempotency record ${where.key}`);
    const updated = { ...existing, ...data };
    idempotencyRecords.set(where.key, updated);
    return updated;
  });
});

describe('POST /api/public/deals/[id]/checkout', () => {
  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({ customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name and phone/i);
  });

  it('returns 400 when phone is missing', async () => {
    const res = await POST(makeRequest({ customerName: 'Jane', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name and phone/i);
  });

  it('returns 400 when phone is invalid', async () => {
    mockIsValidPhone.mockReturnValue(false);
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: 'not-a-phone', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid phone/i);
  });

  it('returns 404 when deal does not exist', async () => {
    mockDealFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when deal is inactive', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, active: false });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 when deal is a code_claim type', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, deliveryType: 'code_claim' });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/code/i);
  });

  it('returns 400 when deal has not started yet', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, startsAt: new Date(now + 86400_000) });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not currently active/i);
  });

  it('returns 400 when deal has expired', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, expiresAt: new Date(now - 1000) });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not currently active/i);
  });

  it('returns 400 when deal is sold out', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, maxRedemptions: 10, redemptionCount: 10 });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sold out/i);
  });

  it('returns 400 when selected services fail pricing validation', async () => {
    mockResolveSelected.mockImplementation(() => {
      throw new DealPurchasePricingError('One or more selected services are not eligible for this deal');
    });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-bad'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/eligible/i);
  });

  it('returns 409 when business Stripe Connect is not ready', async () => {
    mockEnsureConnect.mockResolvedValue({ ...readyConnectAccount, charges_enabled: false });
    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/not ready/i);
  });

  it('returns 409 when the deal is only for new customers and the phone already exists', async () => {
    mockDealFindUnique.mockResolvedValue({ ...baseDeal, newCustomersOnly: true });
    mockCustomerFindFirst.mockResolvedValue({ id: 'cust-existing' });

    const res = await POST(makeRequest({ customerName: 'Jane', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/only available to new customers/i);
    expect(mockCreatePending).not.toHaveBeenCalled();
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('allows recipient transfer-only payout accounts when the shared readiness helper marks them ready', async () => {
    mockEnsureConnect.mockResolvedValue({
      id: 'acct_recipient',
      charges_enabled: false,
      payouts_enabled: true,
      details_submitted: true,
      capabilities: { transfers: 'active' },
    });
    mockIsConnectAccountReady.mockReturnValue(true);

    const res = await POST(
      makeRequest({ customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }),
      { params: Promise.resolve({ id: 'deal-1' }) }
    );

    expect(res.status).toBe(200);
    expect(mockSessionCreate).toHaveBeenCalledTimes(1);
  });

  it('creates a Stripe Checkout session and returns the URL for a paid deal', async () => {
    const req = makeRequest({ customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] });
    const res = await POST(req, { params: Promise.resolve({ id: 'deal-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://checkout.stripe.com/pay/cs_test_123');
    expect(body.purchaseId).toBe('purchase-1');

    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        payment_intent_data: expect.objectContaining({
          application_fee_amount: basePurchase.applicationFeeAmount,
          transfer_data: { destination: readyConnectAccount.id },
        }),
        success_url: expect.stringContaining(`/deal-purchases/${basePurchase.token}`),
        cancel_url: expect.stringContaining(`/d/${baseDeal.id}`),
        metadata: expect.objectContaining({ kind: 'deal_purchase', dealPurchaseId: 'purchase-1' }),
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    );

    expect(mockDealPurchaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripeCheckoutSessionId: 'cs_test_123' } })
    );
  });

  it('does not set payment_method_types so Apple Pay is available automatically', async () => {
    const req = makeRequest({ customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] });
    await POST(req, { params: Promise.resolve({ id: 'deal-1' }) });

    const callArg = mockSessionCreate.mock.calls[0][0];
    expect(callArg).not.toHaveProperty('payment_method_types');
  });

  it('replays duplicate purchase-link checkout requests without creating another purchase or Stripe session', async () => {
    const payload = { customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] };

    const first = await POST(makeRequest(payload), { params: Promise.resolve({ id: 'deal-1' }) });
    const second = await POST(makeRequest(payload), { params: Promise.resolve({ id: 'deal-1' }) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers.get('x-idempotency-replayed')).toBe('true');
    await expect(second.json()).resolves.toEqual({
      url: 'https://checkout.stripe.com/pay/cs_test_123',
      purchaseId: 'purchase-1',
    });
    expect(mockCreatePending).toHaveBeenCalledTimes(1);
    expect(mockSessionCreate).toHaveBeenCalledTimes(1);
    expect(mockDealPurchaseUpdate).toHaveBeenCalledTimes(1);
  });

  it('finalizes a free deal immediately without creating a Stripe session', async () => {
    mockCalculateTotals.mockReturnValue({ subtotalAmount: 5000, discountAmount: 5000, totalAmount: 0, items: [] });
    mockFinalize.mockResolvedValue({ id: 'purchase-1' });

    const res = await POST(makeRequest({ customerName: 'Jane Doe', customerPhone: '5551234567', selectedServiceIds: ['svc-1'] }), { params: Promise.resolve({ id: 'deal-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain(`/deal-purchases/${basePurchase.token}`);
    expect(body.immediate).toBe(true);

    expect(mockSessionCreate).not.toHaveBeenCalled();
    expect(mockFinalize).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { dealPurchaseId: 'purchase-1' } }),
      'https://clientific.net'
    );
  });
});
