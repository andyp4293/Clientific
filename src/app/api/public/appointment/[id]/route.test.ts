import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: { findUnique: vi.fn() },
    service: { findMany: vi.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockAppointmentFindUnique = prisma.appointment.findUnique as ReturnType<typeof vi.fn>;
const mockServiceFindMany = prisma.service.findMany as ReturnType<typeof vi.fn>;

describe('GET /api/public/appointment/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(null);
    mockAppointmentFindUnique.mockResolvedValue({
      id: 'appt-1',
      status: 'confirmed',
      startTime: '2026-03-22T15:00:00.000Z',
      endTime: '2026-03-22T15:30:00.000Z',
      duration: 30,
      notes: null,
      serviceIds: ['svc-1'],
      staffId: null,
      service: null,
      staff: null,
      business: {
        id: 'biz-1',
        name: 'Test Salon',
        phone: '+15551234567',
        timezone: 'America/New_York',
        slug: 'test-salon',
        publicId: 'pub-1',
      },
    });
    mockServiceFindMany.mockResolvedValue([{ name: 'Haircut', price: 4500 }]);
  });

  it('keeps viewerCanManage false for public visitors and does not expose the internal business id', async () => {
    const req = new NextRequest('http://localhost/api/public/appointment/appt-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'appt-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewerCanManage).toBe(false);
    expect(body.appointment.business.id).toBeUndefined();
  });

  it('marks viewerCanManage true for the owning business session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        businessId: 'biz-1',
      },
    });

    const req = new NextRequest('http://localhost/api/public/appointment/appt-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'appt-1' }) });

    const body = await res.json();
    expect(body.viewerCanManage).toBe(true);
    expect(body.appointment.business.name).toBe('Test Salon');
  });
});
