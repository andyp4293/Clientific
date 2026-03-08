import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    affiliate: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/affiliate', () => ({
  generateAffiliateCode: vi.fn().mockResolvedValue('AFF12345'),
}));

import { prisma } from '@/lib/prisma';
import { POST } from './route';

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/public/affiliate/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/public/affiliate/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid email', async () => {
    const res = await POST(req({ name: 'Alice', email: 'bad-email' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when text contains disallowed content', async () => {
    const res = await POST(req({ name: 'Porn Broker', email: 'alice@example.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/disallowed content/i);
  });

  it('returns 409 when affiliate already exists', async () => {
    vi.mocked(prisma.affiliate.findUnique).mockResolvedValue({ id: 'aff-1' } as any);
    const res = await POST(req({ name: 'Alice', email: 'alice@example.com' }));
    expect(res.status).toBe(409);
  });

  it('creates affiliate account when request is valid', async () => {
    vi.mocked(prisma.affiliate.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.affiliate.create).mockResolvedValue({ id: 'aff-1', code: 'AFF12345' } as any);

    const res = await POST(req({ name: 'Alice', email: 'alice@example.com', payoutInfo: 'PayPal' }));
    expect(res.status).toBe(200);
    expect(prisma.affiliate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Alice',
          email: 'alice@example.com',
          code: 'AFF12345',
          payoutInfo: 'PayPal',
        }),
      })
    );
  });
});
