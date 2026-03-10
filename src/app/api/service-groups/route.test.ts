import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    serviceGroup: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
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
import { GET, POST } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.serviceGroup.findMany as ReturnType<typeof vi.fn>;
const mockAggregate = prisma.serviceGroup.aggregate as ReturnType<typeof vi.fn>;
const mockCreate = prisma.serviceGroup.create as ReturnType<typeof vi.fn>;

const activeSession = { user: { businessId: 'biz-1', email: 'owner@test.com' } };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/service-groups', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/service-groups', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns sorted groups for the business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue({ id: 'biz-1' });
    mockFindMany.mockResolvedValue([
      { id: 'g1', name: 'Hair', sortOrder: 0, _count: { services: 2 } },
      { id: 'g2', name: 'Spa', sortOrder: 1, _count: { services: 1 } },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toHaveLength(2);
    expect(prisma.serviceGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 'biz-1' },
      })
    );
  });
});

describe('POST /api/service-groups', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: 'Hair' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is empty', async () => {
    mockSession.mockResolvedValue(activeSession);
    const res = await POST(makeRequest({ name: '   ' }));
    expect(res.status).toBe(400);
  });

  it('creates group with next sortOrder', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue({ id: 'biz-1' });
    mockAggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
    mockCreate.mockResolvedValue({
      id: 'g5',
      businessId: 'biz-1',
      name: 'Pedicures',
      sortOrder: 5,
      _count: { services: 0 },
    });

    const res = await POST(makeRequest({ name: 'Pedicures' }));
    expect(res.status).toBe(201);
    expect(prisma.serviceGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          name: 'Pedicures',
          sortOrder: 5,
        }),
      })
    );
  });
});
