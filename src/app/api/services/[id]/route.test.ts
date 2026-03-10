import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    service: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    serviceGroup: { findFirst: vi.fn() },
    appointment: { count: vi.fn() },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { PATCH } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockServiceFindFirst = prisma.service.findFirst as ReturnType<typeof vi.fn>;
const mockServiceGroupFindFirst = prisma.serviceGroup.findFirst as ReturnType<typeof vi.fn>;
const mockServiceUpdate = prisma.service.update as ReturnType<typeof vi.fn>;

const session = { user: { businessId: 'biz-1', email: 'owner@test.com' } };

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/services/svc-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/services/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ name: 'New Name' }), {
      params: Promise.resolve({ id: 'svc-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when groupId is invalid for business', async () => {
    mockSession.mockResolvedValue(session);
    mockBusiness.mockResolvedValue({ id: 'biz-1' });
    mockServiceFindFirst.mockResolvedValue({ id: 'svc-1' });
    mockServiceGroupFindFirst.mockResolvedValue(null);

    const res = await PATCH(makePatchRequest({ groupId: 'bad-group' }), {
      params: Promise.resolve({ id: 'svc-1' }),
    });
    expect(res.status).toBe(400);
  });

  it('updates group assignment and sortOrder', async () => {
    mockSession.mockResolvedValue(session);
    mockBusiness.mockResolvedValue({ id: 'biz-1' });
    mockServiceFindFirst.mockResolvedValue({ id: 'svc-1' });
    mockServiceGroupFindFirst.mockResolvedValue({ id: 'group-1' });
    mockServiceUpdate.mockResolvedValue({
      id: 'svc-1',
      name: 'Haircut',
      duration: 30,
      groupId: 'group-1',
      active: true,
      sortOrder: 8,
    });

    const res = await PATCH(makePatchRequest({ groupId: 'group-1', sortOrder: 8 }), {
      params: Promise.resolve({ id: 'svc-1' }),
    });
    expect(res.status).toBe(200);
    expect(mockServiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'svc-1' },
        data: expect.objectContaining({
          groupId: 'group-1',
          sortOrder: 8,
        }),
      })
    );
  });
});
