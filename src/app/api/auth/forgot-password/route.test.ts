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
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { POST } from './route';

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for missing email', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email', async () => {
    const res = await POST(req({ email: 'bad-email' }));
    expect(res.status).toBe(400);
  });

  it('returns success without sending when account does not exist', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);

    const res = await POST(req({ email: 'missing@example.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(prisma.business.update).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('lowercases email before lookup', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);

    await POST(req({ email: 'OWNER@EXAMPLE.COM' }));
    expect(prisma.business.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'owner@example.com' } })
    );
  });

  it('stores reset token and sends reset email for known account', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      email: 'owner@example.com',
    } as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);

    const res = await POST(req({ email: 'owner@example.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: expect.objectContaining({
          resetToken: expect.any(String),
          resetTokenExpiry: expect.any(Date),
        }),
      })
    );
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('owner@example.com', expect.any(String));
  });

  it('returns 500 when email provider send fails', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      email: 'owner@example.com',
    } as any);
    vi.mocked(prisma.business.update).mockResolvedValue({} as any);
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('Missing API key'));

    const res = await POST(req({ email: 'owner@example.com' }));
    expect(res.status).toBe(500);
    expect(prisma.business.update).toHaveBeenCalled();
  });
});

