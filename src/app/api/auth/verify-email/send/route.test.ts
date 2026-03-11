import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib/prisma';
import { sendEmailVerificationEmail } from '@/lib/email';
import { POST } from './route';

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/verify-email/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/verify-email/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid email', async () => {
    const res = await POST(req({ email: 'bad-email' }));
    expect(res.status).toBe(400);
  });

  it('returns success without sending when account does not exist', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);

    const res = await POST(req({ email: 'missing@example.com' }));
    expect(res.status).toBe(200);
    expect(sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it('returns success without sending when account is already verified', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      email: 'owner@example.com',
      emailVerifiedAt: new Date(),
    } as any);

    const res = await POST(req({ email: 'owner@example.com' }));
    expect(res.status).toBe(200);
    expect(prisma.business.update).not.toHaveBeenCalled();
    expect(sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it('rotates token and sends email for unverified account', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      email: 'owner@example.com',
      emailVerifiedAt: null,
    } as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);

    const res = await POST(req({ email: 'owner@example.com' }));
    expect(res.status).toBe(200);
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: expect.objectContaining({
          emailVerificationTokenHash: expect.any(String),
          emailVerificationTokenExpiry: expect.any(Date),
          verificationSentAt: expect.any(Date),
        }),
      })
    );
    expect(sendEmailVerificationEmail).toHaveBeenCalledWith('owner@example.com', expect.any(String));
  });

  it('returns 500 when provider send fails', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      email: 'owner@example.com',
      emailVerifiedAt: null,
    } as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);
    vi.mocked(sendEmailVerificationEmail).mockRejectedValueOnce(new Error('Missing API key'));

    const res = await POST(req({ email: 'owner@example.com' }));
    expect(res.status).toBe(500);
  });
});
