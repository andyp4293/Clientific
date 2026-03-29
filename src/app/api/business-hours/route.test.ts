import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('../auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    businessHours: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    businessClosureDate: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from 'next-auth';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { GET, PATCH } from './route';

const mockSession = vi.mocked(getServerSession);
const mockFindUnique = vi.mocked(prisma.businessHours.findUnique);
const mockUpsert = vi.mocked(prisma.businessHours.upsert);
const mockFindClosures = vi.mocked(prisma.businessClosureDate.findMany);
const mockDeleteClosures = vi.mocked(prisma.businessClosureDate.deleteMany);
const mockCreateClosures = vi.mocked(prisma.businessClosureDate.createMany);
const mockTransaction = vi.mocked(prisma.$transaction);

describe('/api/business-hours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: 'biz-1' } } as any);
    mockFindClosures.mockResolvedValue([]);
    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        businessHours: { upsert: mockUpsert },
        businessClosureDate: {
          deleteMany: mockDeleteClosures,
          createMany: mockCreateClosures,
        },
      })
    );
  });

  it('returns weekly hours plus closure dates', async () => {
    mockFindUnique.mockResolvedValue({
      hours: {
        0: { isOpen: false, openTime: null, closeTime: null },
        1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
    } as any);
    mockFindClosures.mockResolvedValue([
      { date: '2026-12-25', label: 'Christmas Day' },
    ] as any);

    const res = await GET(new NextRequest('http://localhost/api/business-hours'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      closureDates: [{ date: '2026-12-25', label: 'Christmas Day' }],
    });
  });

  it('returns defaults when no weekly hours are saved yet', async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(new NextRequest('http://localhost/api/business-hours'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.businessHours).toHaveLength(7);
    expect(body.closureDates).toEqual([]);
  });

  it('saves weekly hours and replaces specific closure dates together', async () => {
    const req = new NextRequest('http://localhost/api/business-hours', {
      method: 'PATCH',
      body: JSON.stringify({
        hours: [
          { dayOfWeek: 0, isOpen: false, openTime: null, closeTime: null },
          { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' },
        ],
        closures: [
          { date: '2026-12-25', label: 'Christmas Day' },
          { date: '2026-11-26', label: 'Thanksgiving' },
        ],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 'biz-1' },
        update: expect.objectContaining({
          hours: expect.objectContaining({
            '1': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          }),
        }),
      })
    );
    expect(mockDeleteClosures).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
    });
    expect(mockCreateClosures).toHaveBeenCalledWith({
      data: [
        { businessId: 'biz-1', date: '2026-11-26', label: 'Thanksgiving' },
        { businessId: 'biz-1', date: '2026-12-25', label: 'Christmas Day' },
      ],
    });
    expect(revalidateTag).toHaveBeenCalledWith('business-hours-biz-1', 'max');
  });

  it('rejects invalid closed dates', async () => {
    const req = new NextRequest('http://localhost/api/business-hours', {
      method: 'PATCH',
      body: JSON.stringify({
        hours: [{ dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' }],
        closures: [{ date: 'not-a-date', label: 'Bad' }],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await PATCH(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'One or more closed dates are invalid',
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
