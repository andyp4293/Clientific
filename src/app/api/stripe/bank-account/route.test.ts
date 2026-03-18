import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => {
  const ensureBusinessConnectAccount = vi.fn();
  const addBankAccountToConnect = vi.fn();
  const removeBankAccountFromConnect = vi.fn();
  const syncBusinessConnectAccount = vi.fn();
  return {
    ensureBusinessConnectAccount,
    addBankAccountToConnect,
    removeBankAccountFromConnect,
    syncBusinessConnectAccount,
  };
});

vi.mock('@/lib/stripe-connect', () => hoisted);
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn(() => 'biz-1') }));
vi.mock('@/lib/stripe', () => ({
  stripe: { accounts: { retrieve: vi.fn().mockResolvedValue({ id: 'acct_custom', charges_enabled: true, payouts_enabled: true, details_submitted: false }) } },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
    businessBankAccount: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { GET, POST, DELETE } from './route';
import { prisma } from '@/lib/prisma';

const mockBankAccountFind = prisma.businessBankAccount.findUnique as ReturnType<typeof vi.fn>;
const mockBankAccountUpsert = prisma.businessBankAccount.upsert as ReturnType<typeof vi.fn>;
const mockBankAccountDelete = prisma.businessBankAccount.delete as ReturnType<typeof vi.fn>;
const mockBusinessFind = prisma.business.findUnique as ReturnType<typeof vi.fn>;

const sampleBankAccount = {
  id: 'ba-1',
  businessId: 'biz-1',
  stripeExternalAccountId: 'ba_stripe_1',
  bankName: 'STRIPE TEST BANK',
  last4: '6789',
  routingNumberLast4: '0000',
  accountHolderName: 'Acme Corp',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const sampleBusiness = {
  id: 'biz-1',
  email: 'biz@example.com',
  name: 'Acme Corp',
  stripeConnectAccountId: 'acct_custom',
};

function makeRequest(body?: object) {
  return new NextRequest('http://localhost/api/stripe/bank-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost' },
    body: JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.ensureBusinessConnectAccount.mockResolvedValue({ id: 'acct_custom', charges_enabled: true, payouts_enabled: true });
  hoisted.addBankAccountToConnect.mockResolvedValue({ id: 'ba_stripe_1', bank_name: 'STRIPE TEST BANK', last4: '6789' });
  hoisted.removeBankAccountFromConnect.mockResolvedValue(undefined);
  hoisted.syncBusinessConnectAccount.mockResolvedValue(undefined);
  mockBankAccountFind.mockResolvedValue(null);
  mockBankAccountUpsert.mockResolvedValue(sampleBankAccount);
  mockBankAccountDelete.mockResolvedValue(sampleBankAccount);
  mockBusinessFind.mockResolvedValue(sampleBusiness);
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/stripe/bank-account', () => {
  it('returns null when no bank account exists', async () => {
    mockBankAccountFind.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).bankAccount).toBeNull();
  });

  it('returns masked bank account info', async () => {
    mockBankAccountFind.mockResolvedValue(sampleBankAccount);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.bankAccount.last4).toBe('6789');
    expect(body.bankAccount.bankName).toBe('STRIPE TEST BANK');
    // Never expose full account number
    expect(body.bankAccount.accountNumber).toBeUndefined();
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/bank-account', () => {
  it('returns 400 when routing number is not 9 digits', async () => {
    const res = await POST(makeRequest({ routingNumber: '123', accountNumber: '000123456789', accountHolderName: 'Acme' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/routing number/i);
  });

  it('returns 400 when account number is missing', async () => {
    const res = await POST(makeRequest({ routingNumber: '110000000', accountNumber: '', accountHolderName: 'Acme' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/account number/i);
  });

  it('returns 400 when account holder name is missing', async () => {
    const res = await POST(makeRequest({ routingNumber: '110000000', accountNumber: '000123456789', accountHolderName: '' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/account holder/i);
  });

  it('creates Custom Connect account and attaches bank account', async () => {
    const res = await POST(makeRequest({ routingNumber: '110000000', accountNumber: '000123456789', accountHolderName: 'Acme Corp' }));
    expect(res.status).toBe(200);
    expect(hoisted.ensureBusinessConnectAccount).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'biz-1' }),
      expect.any(String)
    );
    expect(hoisted.addBankAccountToConnect).toHaveBeenCalledWith(
      'acct_custom', '110000000', '000123456789', 'Acme Corp'
    );
    const body = await res.json();
    expect(body.bankAccount.last4).toBe('6789');
    expect(body.bankAccount.bankName).toBe('STRIPE TEST BANK');
  });

  it('removes old bank account before adding new one', async () => {
    mockBankAccountFind.mockResolvedValue(sampleBankAccount);
    await POST(makeRequest({ routingNumber: '110000000', accountNumber: '000999888777', accountHolderName: 'Acme Corp' }));
    expect(hoisted.removeBankAccountFromConnect).toHaveBeenCalledWith('acct_custom', 'ba_stripe_1');
    expect(hoisted.addBankAccountToConnect).toHaveBeenCalled();
  });

  it('saves masked bank info to DB (never full account number)', async () => {
    await POST(makeRequest({ routingNumber: '110000000', accountNumber: '000123456789', accountHolderName: 'Acme Corp' }));
    expect(mockBankAccountUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          last4: '6789',
          routingNumberLast4: '0000',
          stripeExternalAccountId: 'ba_stripe_1',
        }),
      })
    );
    // Full account number must never be stored
    const call = mockBankAccountUpsert.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain('000123456789');
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/stripe/bank-account', () => {
  it('returns 404 when no bank account exists', async () => {
    mockBankAccountFind.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(404);
  });

  it('removes from Stripe and deletes from DB', async () => {
    mockBankAccountFind.mockResolvedValue(sampleBankAccount);
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(hoisted.removeBankAccountFromConnect).toHaveBeenCalledWith('acct_custom', 'ba_stripe_1');
    expect(mockBankAccountDelete).toHaveBeenCalledWith({ where: { businessId: 'biz-1' } });
  });
});
