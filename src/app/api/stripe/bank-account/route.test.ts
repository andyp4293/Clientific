import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn(() => 'biz-1') }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    businessBankAccount: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { GET, POST, DELETE } from './route';
import { prisma } from '@/lib/prisma';

const mockFind = prisma.businessBankAccount.findUnique as ReturnType<typeof vi.fn>;
const mockUpsert = prisma.businessBankAccount.upsert as ReturnType<typeof vi.fn>;
const mockDelete = prisma.businessBankAccount.delete as ReturnType<typeof vi.fn>;

const sampleBankAccount = {
  id: 'ba-1',
  businessId: 'biz-1',
  bankName: null,
  last4: '6789',
  routingNumberLast4: '0000',
  accountHolderName: 'Acme Corp',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

function makeRequest(body?: object) {
  return new NextRequest('http://localhost/api/stripe/bank-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFind.mockResolvedValue(null);
  mockUpsert.mockResolvedValue(sampleBankAccount);
  mockDelete.mockResolvedValue(sampleBankAccount);
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/stripe/bank-account', () => {
  it('returns null when no bank account exists', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).bankAccount).toBeNull();
  });

  it('returns masked bank account info', async () => {
    mockFind.mockResolvedValue(sampleBankAccount);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.bankAccount.last4).toBe('6789');
    expect(body.bankAccount.routingNumberLast4).toBe('0000');
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

  it('saves masked bank info to DB (never full account number)', async () => {
    const res = await POST(makeRequest({ routingNumber: '110000000', accountNumber: '000123456789', accountHolderName: 'Acme Corp' }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          last4: '6789',
          routingNumberLast4: '0000',
          accountHolderName: 'Acme Corp',
        }),
      })
    );
    // Full account number must never be stored
    const call = mockUpsert.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain('000123456789');
  });

  it('returns masked bank account in response', async () => {
    const res = await POST(makeRequest({ routingNumber: '110000000', accountNumber: '000123456789', accountHolderName: 'Acme Corp' }));
    const body = await res.json();
    expect(body.bankAccount.last4).toBe('6789');
    expect(body.bankAccount.routingNumberLast4).toBe('0000');
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/stripe/bank-account', () => {
  it('returns 404 when no bank account exists', async () => {
    const res = await DELETE();
    expect(res.status).toBe(404);
  });

  it('deletes from DB and returns success', async () => {
    mockFind.mockResolvedValue(sampleBankAccount);
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({ where: { businessId: 'biz-1' } });
    expect((await res.json()).success).toBe(true);
  });
});
