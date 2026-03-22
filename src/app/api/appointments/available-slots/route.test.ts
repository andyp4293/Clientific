import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('../../auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    businessHours: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    appointment: { findMany: vi.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

describe('GET /api/appointments/available-slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'owner@test.com' },
    } as any);
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      timezone: 'America/New_York',
      closureDates: [],
    } as any);
    vi.mocked(prisma.businessHours.findUnique).mockResolvedValue({
      hours: {
        2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
    } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
  });

  it('returns no slots on a specific closed date', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      timezone: 'America/New_York',
      closureDates: [{ date: '2026-03-10', label: 'Training Day' }],
    } as any);

    const res = await GET(
      new NextRequest(
        'http://localhost/api/appointments/available-slots?date=2026-03-10'
      )
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ availableSlots: [] });
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });
});
