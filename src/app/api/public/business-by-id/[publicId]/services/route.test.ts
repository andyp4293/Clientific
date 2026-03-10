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

describe('GET /api/public/business-by-id/[publicId]/services', () => {
  it('returns 404 when business is missing', async () => {
    mockBusiness.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/public/business-by-id/CF-123456/services');
    const res = await GET(req, { params: Promise.resolve({ publicId: 'CF-123456' }) });
    expect(res.status).toBe(404);
  });

  it('returns services and groups when business exists', async () => {
    mockBusiness.mockResolvedValue({ id: 'biz-1', enableOnlineBooking: true });
    mockGroupFindMany.mockResolvedValue([{ id: 'g1', name: 'Pedicure', sortOrder: 0 }]);
    mockServiceFindMany.mockResolvedValue([
      { id: 's1', groupId: null, name: 'Trim', description: null, duration: 15, price: 12, sortOrder: 0 },
    ]);

    const req = new NextRequest('http://localhost/api/public/business-by-id/CF-123456/services');
    const res = await GET(req, { params: Promise.resolve({ publicId: 'CF-123456' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toEqual([{ id: 'g1', name: 'Pedicure', sortOrder: 0 }]);
    expect(body.services[0].name).toBe('Trim');
  });
});
