import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { hashVerificationToken, packVerificationHash } from '@/lib/auth-verification';
import { POST } from './route';

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/verify-email/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/verify-email/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email and code are missing', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed code', async () => {
    const res = await POST(req({ email: 'owner@example.com', code: '12ab' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when business is not found for code verification', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);
    const res = await POST(req({ email: 'owner@example.com', code: '123456' }));
    expect(res.status).toBe(400);
  });

  it('increments failed attempt count for invalid code', async () => {
    const validHash = hashVerificationToken('654321');
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      email: 'owner@example.com',
      emailVerifiedAt: null,
      emailVerificationTokenHash: packVerificationHash(validHash, 1),
      emailVerificationTokenExpiry: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);

    const res = await POST(req({ email: 'owner@example.com', code: '111111' }));
    expect(res.status).toBe(400);
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: { emailVerificationTokenHash: packVerificationHash(validHash, 2) },
      })
    );
  });

  it('invalidates verification after max failed attempts', async () => {
    const validHash = hashVerificationToken('654321');
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      email: 'owner@example.com',
      emailVerifiedAt: null,
      emailVerificationTokenHash: packVerificationHash(validHash, 4),
      emailVerificationTokenExpiry: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);

    const res = await POST(req({ email: 'owner@example.com', code: '111111' }));
    expect(res.status).toBe(400);
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: {
          emailVerificationTokenHash: null,
          emailVerificationTokenExpiry: null,
        },
      })
    );
  });

  it('verifies account when code is valid', async () => {
    const validHash = hashVerificationToken('654321');
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      email: 'owner@example.com',
      emailVerifiedAt: null,
      emailVerificationTokenHash: packVerificationHash(validHash, 0),
      emailVerificationTokenExpiry: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);

    const res = await POST(req({ email: 'owner@example.com', code: '654321' }));
    expect(res.status).toBe(200);
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: expect.objectContaining({
          emailVerifiedAt: expect.any(Date),
          emailVerificationTokenHash: null,
          emailVerificationTokenExpiry: null,
        }),
      })
    );
  });

  it('keeps legacy token verification working', async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-legacy',
      email: 'legacy@example.com',
    } as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);

    const res = await POST(req({ token: 'legacy-verification-token-1234567890' }));
    expect(res.status).toBe(200);
    expect(prisma.business.findFirst).toHaveBeenCalled();
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-legacy' },
        data: expect.objectContaining({
          emailVerifiedAt: expect.any(Date),
        }),
      })
    );
  });
});
