import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    businessHours: { findUnique: vi.fn() },
    staff: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), findUniqueOrThrow: vi.fn() },
    staffService: { deleteMany: vi.fn(), createMany: vi.fn() },
    appointment: { count: vi.fn(), updateMany: vi.fn() },
    checkIn: { updateMany: vi.fn() },
    $transaction: vi.fn((ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      if (typeof ops === 'function') {
        const tx = {
          staff: {
            update: vi.fn().mockResolvedValue({ id: 'staff-1' }),
            findUniqueOrThrow: vi.fn(),
          },
          staffService: { deleteMany: vi.fn(), createMany: vi.fn() },
        };
        return (ops as (tx: unknown) => unknown)(tx);
      }
      return Promise.resolve();
    }),
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {},
  PRICING_PLANS: {
    STARTER: { name: 'Starter', limits: { customers: 100, staff: 10, services: 10 } },
    PRO: { name: 'Pro', limits: { customers: 1000, staff: 50, services: 50 } },
    PREMIUM: { name: 'Premium', limits: { customers: Infinity, staff: Infinity, services: Infinity } },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { PATCH, DELETE } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockStaffFindUnique = prisma.staff.findUnique as ReturnType<typeof vi.fn>;
const mockAppointmentCount = prisma.appointment.count as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

const activeSession = { user: { id: 'biz-1' } };
const existingStaff = { id: 'staff-1', businessId: 'biz-1', fullName: 'Jane', active: true };

function makePatchRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/staff/staff-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function makeDeleteRequest() {
  return new NextRequest('http://localhost/api/staff/staff-1', { method: 'DELETE' });
}

const routeParams = { params: Promise.resolve({ id: 'staff-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
});

// ── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/staff/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest(), routeParams);
    expect(res.status).toBe(401);
  });

  it('returns 403 when subscription expired', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() - 86400_000),
    });
    const res = await PATCH(makePatchRequest(), routeParams);
    expect(res.status).toBe(403);
  });

  it('returns 404 when staff not found', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ fullName: 'Jane' }), routeParams);
    expect(res.status).toBe(404);
  });

  it('returns 404 when staff belongs to another business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', businessId: 'other-biz' });
    const res = await PATCH(makePatchRequest({ fullName: 'Jane' }), routeParams);
    expect(res.status).toBe(404);
  });

  it('returns 400 when name contains blocked content', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue(existingStaff);
    const res = await PATCH(makePatchRequest({ fullName: 'Porn Star' }), routeParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/disallowed content/i);
  });

  it('updates staff and returns 200', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue(existingStaff);

    const updatedStaff = {
      id: 'staff-1',
      fullName: 'Jane Updated',
      businessId: 'biz-1',
      email: null,
      phone: null,
      role: 'staff',
      active: true,
      workDays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: new Date(),
      updatedAt: new Date(),
      serviceAssignments: [],
    };

    mockTransaction.mockImplementationOnce(async (fn: any) => {
      const tx = {
        staff: {
          update: vi.fn().mockResolvedValue({ id: 'staff-1' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(updatedStaff),
        },
        staffService: { deleteMany: vi.fn(), createMany: vi.fn() },
      };
      return fn(tx);
    });

    const res = await PATCH(makePatchRequest({ fullName: 'Jane Updated' }), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.staff.fullName).toBe('Jane Updated');
    expect(body.staff.serviceIds).toEqual([]);
  });

  it('replaces service assignments when serviceIds provided', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue(existingStaff);

    const updatedStaff = {
      id: 'staff-1',
      fullName: 'Jane',
      businessId: 'biz-1',
      email: null,
      phone: null,
      role: 'staff',
      active: true,
      workDays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: new Date(),
      updatedAt: new Date(),
      serviceAssignments: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }],
    };

    const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockCreateMany = vi.fn().mockResolvedValue({ count: 2 });

    mockTransaction.mockImplementationOnce(async (fn: any) => {
      const tx = {
        staff: {
          update: vi.fn().mockResolvedValue({ id: 'staff-1' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(updatedStaff),
        },
        staffService: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
      };
      return fn(tx);
    });

    const res = await PATCH(
      makePatchRequest({ fullName: 'Jane', serviceIds: ['svc-1', 'svc-2'] }),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { staffId: 'staff-1' } });
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        { staffId: 'staff-1', serviceId: 'svc-1' },
        { staffId: 'staff-1', serviceId: 'svc-2' },
      ],
      skipDuplicates: true,
    });
    const body = await res.json();
    expect(body.staff.serviceIds).toEqual(['svc-1', 'svc-2']);
  });

  it('stores custom work-hour overrides on update', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue({ ...existingStaff, workDays: [1], workHours: null });
    vi.mocked(prisma.businessHours.findUnique).mockResolvedValue({
      hours: {
        1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
    } as any);

    const updateMock = vi.fn().mockResolvedValue({ id: 'staff-1' });
    const updatedStaff = {
      id: 'staff-1',
      fullName: 'Jane',
      businessId: 'biz-1',
      email: null,
      phone: null,
      role: 'staff',
      active: true,
      workDays: [1],
      workHours: {
        1: { startTime: '10:00', endTime: '16:00' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      serviceAssignments: [],
    };

    mockTransaction.mockImplementationOnce(async (fn: any) => {
      const tx = {
        staff: {
          update: updateMock,
          findUniqueOrThrow: vi.fn().mockResolvedValue(updatedStaff),
        },
        staffService: { deleteMany: vi.fn(), createMany: vi.fn() },
      };
      return fn(tx);
    });

    const res = await PATCH(
      makePatchRequest({
        fullName: 'Jane',
        workDays: [1],
        workHours: {
          1: { startTime: '10:00', endTime: '16:00' },
        },
      }),
      routeParams
    );

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workDays: [1],
          workHours: {
            1: { startTime: '10:00', endTime: '16:00' },
          },
        }),
      })
    );
    await expect(res.json()).resolves.toMatchObject({
      staff: {
        workHours: {
          1: { startTime: '10:00', endTime: '16:00' },
        },
      },
    });
  });
});

// ── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/staff/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(401);
  });

  it('returns 403 when subscription expired', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() - 86400_000),
    });
    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(403);
  });

  it('returns 404 when staff not found', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(404);
  });

  it('returns 404 when staff belongs to another business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue({ id: 'staff-1', businessId: 'other-biz' });
    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(404);
  });

  it('returns 400 when staff has active appointments', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue(existingStaff);
    mockAppointmentCount.mockResolvedValue(2);
    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/scheduled appointments/i);
  });

  it('deletes staff with no active appointments and returns 200', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue(existingStaff);
    mockAppointmentCount.mockResolvedValue(0);

    const mockApptUpdate = prisma.appointment.updateMany as ReturnType<typeof vi.fn>;
    const mockCheckInUpdate = prisma.checkIn.updateMany as ReturnType<typeof vi.fn>;
    const mockDelete = prisma.staff.delete as ReturnType<typeof vi.fn>;

    mockApptUpdate.mockResolvedValue({ count: 0 });
    mockCheckInUpdate.mockResolvedValue({ count: 0 });
    mockDelete.mockResolvedValue({ id: 'staff-1' });

    mockTransaction.mockImplementationOnce((ops: unknown[]) => Promise.all(ops));

    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('clears staffId from past appointments before deleting', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    mockStaffFindUnique.mockResolvedValue(existingStaff);
    mockAppointmentCount.mockResolvedValue(0);

    const mockApptUpdate = prisma.appointment.updateMany as ReturnType<typeof vi.fn>;
    const mockCheckInUpdate = prisma.checkIn.updateMany as ReturnType<typeof vi.fn>;
    const mockDelete = prisma.staff.delete as ReturnType<typeof vi.fn>;

    mockApptUpdate.mockResolvedValue({ count: 3 });
    mockCheckInUpdate.mockResolvedValue({ count: 1 });
    mockDelete.mockResolvedValue({ id: 'staff-1' });

    mockTransaction.mockImplementationOnce((ops: unknown[]) => Promise.all(ops));

    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(200);
    expect(mockApptUpdate).toHaveBeenCalledWith({
      where: { staffId: 'staff-1' },
      data: { staffId: null },
    });
    expect(mockCheckInUpdate).toHaveBeenCalledWith({
      where: { staffId: 'staff-1' },
      data: { staffId: null },
    });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'staff-1' } });
  });
});
