import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    serviceGroup: { findMany: vi.fn() },
    service: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockGroupFindMany = prisma.serviceGroup.findMany as ReturnType<typeof vi.fn>;
const mockServiceFindMany = prisma.service.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/public/business/[slug]/services', () => {
  it('blocks access when online booking is disabled and infoOnly is missing', async () => {
    mockBusiness.mockResolvedValue({ id: 'biz-1', enableOnlineBooking: false });
    const req = new NextRequest('http://localhost/api/public/business/test-salon/services');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-salon' }) });
    expect(res.status).toBe(403);
  });

  it('returns grouped metadata in infoOnly mode', async () => {
    mockBusiness.mockResolvedValue({ id: 'biz-1', enableOnlineBooking: false });
    mockGroupFindMany.mockResolvedValue([{ id: 'g1', name: 'Hair', sortOrder: 0 }]);
    mockServiceFindMany.mockResolvedValue([
      { id: 's1', groupId: 'g1', name: 'Cut', description: null, duration: 30, price: 25, sortOrder: 0 },
    ]);

    const req = new NextRequest('http://localhost/api/public/business/test-salon/services?infoOnly=true');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-salon' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toHaveLength(1);
    expect(body.services[0].groupId).toBe('g1');
  });
});
