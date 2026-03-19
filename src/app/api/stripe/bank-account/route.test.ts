import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn(() => 'biz-1') }));
vi.mock('@/lib/app-url', () => ({ getAppBaseUrlFromRequest: vi.fn(() => 'https://clientific.net') }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    businessBankAccount: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/stripe-connect', () => ({
  addBankAccountToConnect: vi.fn(),
  ensureBusinessConnectAccount: vi.fn(),
  removeBankAccountFromConnect: vi.fn(),
  syncBusinessConnectState: vi.fn(),
}));

import { GET, POST, DELETE } from './route';
import { prisma } from '@/lib/prisma';
import {
  addBankAccountToConnect,
  ensureBusinessConnectAccount,
  removeBankAccountFromConnect,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';

const mockBusinessFind = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockBankFind = prisma.businessBankAccount.findUnique as ReturnType<typeof vi.fn>;
const mockBankDeleteMany = prisma.businessBankAccount.deleteMany as ReturnType<typeof vi.fn>;
const mockAddBank = addBankAccountToConnect as ReturnType<typeof vi.fn>;
const mockEnsureConnect = ensureBusinessConnectAccount as ReturnType<typeof vi.fn>;
const mockRemoveBank = removeBankAccountFromConnect as ReturnType<typeof vi.fn>;
const mockSyncState = syncBusinessConnectState as ReturnType<typeof vi.fn>;

const business = {
  id: 'biz-1',
  email: 'owner@example.com',
  name: 'Test Salon',
  stripeConnectAccountId: 'acct_123',
};

const syncedStatus = {
  accountId: 'acct_123',
  chargesEnabled: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
  onboardingComplete: true,
  bankAccountConnected: true,
  externalAccount: {
    id: 'ba_123',
    bankName: 'Chase',
    last4: '6789',
    routingNumberLast4: '1100',
    accountHolderName: 'Acme Corp',
    status: 'verified',
  },
  payoutSchedule: {
    interval: 'manual',
    monthlyPayoutDays: [],
    weeklyPayoutDays: [],
    statementDescriptor: null,
  },
  requirements: {
    currentlyDue: [],
    eventuallyDue: [],
    pastDue: [],
    pendingVerification: [],
    disabledReason: null,
  },
};

const storedBankAccount = {
  id: 'bank-row-1',
  businessId: 'biz-1',
  stripeExternalAccountId: 'ba_123',
  bankName: 'Chase',
  last4: '6789',
  routingNumberLast4: '1100',
  accountHolderName: 'Acme Corp',
  createdAt: new Date('2026-01-01'),
};

function makePostRequest(body?: object) {
  return new NextRequest('http://localhost/api/stripe/bank-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBusinessFind.mockResolvedValue(business);
  mockBankFind.mockResolvedValue(storedBankAccount);
  mockBankDeleteMany.mockResolvedValue({ count: 1 });
  mockEnsureConnect.mockResolvedValue({ id: 'acct_123' });
  mockAddBank.mockResolvedValue({ id: 'ba_123' });
  mockRemoveBank.mockResolvedValue({});
  mockSyncState.mockResolvedValue(syncedStatus);
});

describe('GET /api/stripe/bank-account', () => {
  it('returns null when the business has no connect account yet', async () => {
    mockBusinessFind.mockResolvedValue({ ...business, stripeConnectAccountId: null });

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await res.json()).bankAccount).toBeNull();
  });

  it('returns the synced masked bank account', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(mockSyncState).toHaveBeenCalledWith('biz-1', 'acct_123');
    const body = await res.json();
    expect(body.bankAccount.last4).toBe('6789');
    expect(body.bankAccount.routingNumberLast4).toBe('1100');
  });
});

describe('POST /api/stripe/bank-account', () => {
  it('returns 400 when routing number is not 9 digits', async () => {
    const res = await POST(
      makePostRequest({
        routingNumber: '123',
        accountNumber: '000123456789',
        accountHolderName: 'Acme',
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/routing number/i);
  });

  it('returns 400 when account number is missing', async () => {
    const res = await POST(
      makePostRequest({
        routingNumber: '110000000',
        accountNumber: '',
        accountHolderName: 'Acme',
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/account number/i);
  });

  it('returns 400 when account holder name is missing', async () => {
    const res = await POST(
      makePostRequest({
        routingNumber: '110000000',
        accountNumber: '000123456789',
        accountHolderName: '',
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/account holder/i);
  });

  it('attaches the bank account in Stripe and returns masked details', async () => {
    const res = await POST(
      makePostRequest({
        routingNumber: '110000000',
        accountNumber: '000123456789',
        accountHolderName: 'Acme Corp',
      })
    );

    expect(res.status).toBe(200);
    expect(mockEnsureConnect).toHaveBeenCalled();
    expect(mockRemoveBank).toHaveBeenCalledWith('acct_123', 'ba_123');
    expect(mockAddBank).toHaveBeenCalledWith('acct_123', '110000000', '000123456789', 'Acme Corp');
    expect(mockSyncState).toHaveBeenCalledWith('biz-1', 'acct_123');
    const body = await res.json();
    expect(body.bankAccount.last4).toBe('6789');
    expect(body.bankAccount.accountNumber).toBeUndefined();
  });
});

describe('DELETE /api/stripe/bank-account', () => {
  it('returns 404 when no bank account exists', async () => {
    mockBankFind.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(404);
  });

  it('removes the bank account from Stripe and local state', async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(mockRemoveBank).toHaveBeenCalledWith('acct_123', 'ba_123');
    expect(mockBankDeleteMany).toHaveBeenCalledWith({ where: { businessId: 'biz-1' } });
    expect(mockSyncState).toHaveBeenCalledWith('biz-1', 'acct_123');
    expect((await res.json()).success).toBe(true);
  });
});
