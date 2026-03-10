import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    serviceGroup: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.serviceGroup.findMany as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.serviceGroup.update as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

const session = { user: { businessId: 'biz-1', email: 'owner@test.com' } };

function makeRequest(ids: string[]) {
  return new NextRequest('http://localhost/api/service-groups/reorder', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockResolvedValue([]);
  mockUpdate.mockReturnValue({} as any);
});

describe('POST /api/service-groups/reorder', () => {
  it('returns 400 when ids is empty', async () => {
    mockSession.mockResolvedValue(session);
    const res = await POST(makeRequest([]));
    expect(res.status).toBe(400);
  });

  it('reorders owned groups', async () => {
    mockSession.mockResolvedValue(session);
    mockBusiness.mockResolvedValue({ id: 'biz-1' });
    mockFindMany.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }]);

    const res = await POST(makeRequest(['g1', 'g2']));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockTransaction).toHaveBeenCalled();
  });
});
