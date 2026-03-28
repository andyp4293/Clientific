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
    appointment: { findMany: vi.fn() },
    service: { findMany: vi.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { createAppointmentBatchToken } from '@/lib/appointment-confirmation-batches';
import { GET } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockAppointmentFindMany = prisma.appointment.findMany as ReturnType<typeof vi.fn>;
const mockServiceFindMany = prisma.service.findMany as ReturnType<typeof vi.fn>;

describe('GET /api/public/appointment-batch/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(null);
    mockAppointmentFindMany.mockResolvedValue([
      {
        id: 'appt-1',
        status: 'pending',
        startTime: '2026-03-22T15:00:00.000Z',
        endTime: '2026-03-22T15:30:00.000Z',
        duration: 30,
        notes: null,
        serviceIds: ['svc-1'],
        staffId: 'staff-1',
        customer: { name: 'Jane Doe' },
        service: null,
        staff: { fullName: 'Andy' },
        business: {
          id: 'biz-1',
          name: 'Test Salon',
          phone: '+15551234567',
          timezone: 'America/New_York',
          slug: 'test-salon',
          publicId: 'pub-1',
        },
      },
      {
        id: 'appt-2',
        status: 'confirmed',
        startTime: '2026-03-22T16:00:00.000Z',
        endTime: '2026-03-22T16:30:00.000Z',
        duration: 30,
        notes: null,
        serviceIds: ['svc-2'],
        staffId: null,
        customer: { name: 'Jane Doe' },
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
      },
    ] as any);
    mockServiceFindMany.mockResolvedValue([
      { id: 'svc-1', name: 'Haircut', price: 45 },
      { id: 'svc-2', name: 'Blowout', price: 55 },
    ] as any);
  });

  it('returns grouped appointments without exposing the internal business id', async () => {
    const token = createAppointmentBatchToken({
      b: 'biz-1',
      p: '5551234567',
      s: 1_775_000_000_000,
      e: 1_775_000_060_000,
    });

    const req = new NextRequest(`http://localhost/api/public/appointment-batch/${token}`);
    const res = await GET(req, { params: Promise.resolve({ token }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewerCanManage).toBe(false);
    expect(body.batch.business.id).toBeUndefined();
    expect(body.batch.appointments).toHaveLength(2);
    expect(body.batch.appointments[0].services[0].name).toBe('Haircut');
    expect(body.batch.appointments[1].totalPrice).toBe(55);
  });

  it('marks viewerCanManage true for the owning business session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        businessId: 'biz-1',
      },
    });

    const token = createAppointmentBatchToken({
      b: 'biz-1',
      p: '5551234567',
      s: 1_775_000_000_000,
      e: 1_775_000_060_000,
    });

    const req = new NextRequest(`http://localhost/api/public/appointment-batch/${token}`);
    const res = await GET(req, { params: Promise.resolve({ token }) });

    const body = await res.json();
    expect(body.viewerCanManage).toBe(true);
    expect(body.batch.business.name).toBe('Test Salon');
  });

  it('returns 404 for invalid tokens', async () => {
    const req = new NextRequest('http://localhost/api/public/appointment-batch/not-a-token');
    const res = await GET(req, { params: Promise.resolve({ token: 'not-a-token' }) });

    expect(res.status).toBe(404);
  });
});
