import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
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

  it('returns 400 when token is missing', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is invalid or expired', async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue(null);
    const res = await POST(req({ token: 'a-valid-length-token-1234567890' }));
    expect(res.status).toBe(400);
  });

  it('verifies account and clears verification token', async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1',
      email: 'owner@example.com',
    } as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);

    const res = await POST(req({ token: 'a-valid-length-token-1234567890' }));
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
});
