import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    businessHours: {
      findUnique: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    staff: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    appointment: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    checkIn: {
      updateMany: vi.fn(),
    },
    staffService: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { DELETE, PATCH } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindBusinessHours = prisma.businessHours.findUnique as ReturnType<typeof vi.fn>;
const mockFindServices = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockFindStaff = prisma.staff.findUnique as ReturnType<typeof vi.fn>;
const mockAppointmentCount = prisma.appointment.count as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
});

describe('PATCH /api/mobile/staff/[id]', () => {
  it('updates staff and returns the formatted mobile record', async () => {
    mockFindStaff.mockResolvedValue({
      id: 'staff-1',
      businessId: 'biz-1',
      workDays: [1],
      workHours: { 1: { startTime: '09:00', endTime: '17:00' } },
    });
    mockFindBusinessHours.mockResolvedValue({
      hours: {
        1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
    });
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        staff: {
          update: vi.fn().mockResolvedValue({ id: 'staff-1' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'staff-1',
            fullName: 'Taylor Updated',
            email: 'taylor@example.com',
            phone: '+15557654321',
            role: 'Lead Stylist',
            active: true,
            workDays: [1, 2],
            workHours: {
              1: { startTime: '09:00', endTime: '17:00' },
              2: { startTime: '10:00', endTime: '18:00' },
            },
            serviceAssignments: [{ serviceId: 'svc-1' }],
          }),
        },
        staffService: {
          deleteMany: vi.fn().mockResolvedValue(undefined),
          createMany: vi.fn().mockResolvedValue(undefined),
        },
      }),
    );
    mockFindServices.mockResolvedValue([{ id: 'svc-1', name: 'Haircut' }]);

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/staff/staff-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Taylor Updated',
          role: 'Lead Stylist',
          serviceIds: ['svc-1'],
          workDays: [1, 2],
          workHours: {
            1: { startTime: '09:00', endTime: '17:00' },
            2: { startTime: '10:00', endTime: '18:00' },
          },
        }),
      }),
      { params: Promise.resolve({ id: 'staff-1' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.staff).toMatchObject({
      id: 'staff-1',
      fullName: 'Taylor Updated',
      serviceNames: ['Haircut'],
    });
  });
});

describe('DELETE /api/mobile/staff/[id]', () => {
  it('deletes staff when there are no scheduled appointments', async () => {
    mockFindStaff.mockResolvedValue({
      id: 'staff-1',
      businessId: 'biz-1',
    });
    mockAppointmentCount.mockResolvedValue(0);
    mockTransaction.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request('https://www.clientific.app/api/mobile/staff/staff-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'staff-1' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
