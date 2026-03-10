import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    serviceGroup: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { DELETE, PATCH } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.serviceGroup.findFirst as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.serviceGroup.update as ReturnType<typeof vi.fn>;
const mockDelete = prisma.serviceGroup.delete as ReturnType<typeof vi.fn>;

const session = { user: { businessId: 'biz-1', email: 'owner@test.com' } };

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/service-groups/g1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/service-groups/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ name: 'Hair' }), { params: Promise.resolve({ id: 'g1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when group is missing', async () => {
    mockSession.mockResolvedValue(session);
    mockBusiness.mockResolvedValue({ id: 'biz-1' });
    mockFindFirst.mockResolvedValue(null);

    const res = await PATCH(makePatchRequest({ name: 'Hair' }), { params: Promise.resolve({ id: 'g1' }) });
    expect(res.status).toBe(404);
  });

  it('updates group name', async () => {
    mockSession.mockResolvedValue(session);
    mockBusiness.mockResolvedValue({ id: 'biz-1' });
    mockFindFirst.mockResolvedValue({ id: 'g1' });
    mockUpdate.mockResolvedValue({ id: 'g1', name: 'Manicures' });

    const res = await PATCH(makePatchRequest({ name: 'Manicures' }), { params: Promise.resolve({ id: 'g1' }) });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'g1' },
        data: expect.objectContaining({ name: 'Manicures' }),
      })
    );
  });
});

describe('DELETE /api/service-groups/[id]', () => {
  it('deletes group for the business', async () => {
    mockSession.mockResolvedValue(session);
    mockBusiness.mockResolvedValue({ id: 'biz-1' });
    mockFindFirst.mockResolvedValue({ id: 'g1' });
    mockDelete.mockResolvedValue({ id: 'g1' });

    const res = await DELETE(new NextRequest('http://localhost/api/service-groups/g1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'g1' }),
    });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });
});
