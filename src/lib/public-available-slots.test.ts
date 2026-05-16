import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    service: { findMany: vi.fn() },
    staff: { findFirst: vi.fn(), findMany: vi.fn() },
    appointment: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { getPublicAvailableSlots } from './public-available-slots';

describe('public available slots helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    const dayHours = Object.fromEntries(
      Array.from({ length: 7 }, (_, day) => [
        day.toString(),
        { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      ])
    );
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      enableOnlineBooking: true,
      timezone: 'America/New_York',
      closureDates: [],
      businessHours: {
        hours: dayHours,
      },
    } as any);
    vi.mocked(prisma.service.findMany).mockResolvedValue([{ id: 'svc-1', duration: 60 }] as any);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
  });

  it('returns a dedicated staff-off reason when the selected staff member is off that day', async () => {
    const date = '2099-03-15';
    const dayOfWeek = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const allowedDays = [0, 1, 2, 3, 4, 5, 6].filter((value) => value !== dayOfWeek);

    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      fullName: 'Andy',
      workDays: allowedDays,
      serviceAssignments: [],
    } as any);

    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test-salon' },
      date,
      serviceId: 'svc-1',
      staffId: 'stf-1',
    });

    expect(result).toMatchObject({
      slots: [],
      unavailableSlots: [],
      availabilityReason: 'staff_off_day',
      message: 'Selected staff member is off on this day.',
    });
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('returns a business-closed reason for a date-specific closure', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      enableOnlineBooking: true,
      timezone: 'America/New_York',
      closureDates: [{ date: '2099-12-25', label: 'Christmas Day' }],
      businessHours: {
        hours: Object.fromEntries(
          Array.from({ length: 7 }, (_, day) => [
            day.toString(),
            { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          ])
        ),
      },
    } as any);

    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test-salon' },
      date: '2099-12-25',
      serviceId: 'svc-1',
    });

    expect(result).toMatchObject({
      slots: [],
      unavailableSlots: [],
      availabilityReason: 'business_closed',
      message: 'Business is closed for Christmas Day.',
    });
  });

  it('uses the combined duration when checking multi-service staff availability', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: 'svc-gel', duration: 45 },
      { id: 'svc-pedi', duration: 60 },
    ] as any);
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      fullName: 'Andy',
      workDays: [2],
      serviceAssignments: [],
    } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        startTime: new Date('2026-03-10T16:00:00.000Z'),
        endTime: new Date('2026-03-10T16:30:00.000Z'),
      },
    ] as any);

    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test-salon' },
      date: '2026-03-10',
      serviceId: 'svc-gel',
      serviceIds: ['svc-gel', 'svc-pedi'],
      staffId: 'stf-1',
    });

    expect(result.slots).not.toContain('2026-03-10T15:00:00.000Z');
    expect(result.unavailableSlots).toContain('2026-03-10T15:00:00.000Z');

    vi.useRealTimers();
  });

  it('limits staff slots to that staff member’s configured working hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      fullName: 'Andy',
      workDays: [2],
      workHours: {
        2: { startTime: '10:00', endTime: '13:00' },
      },
      serviceAssignments: [],
    } as any);

    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test-salon' },
      date: '2026-03-10',
      serviceId: 'svc-1',
      staffId: 'stf-1',
    });

    expect(result.slots).toContain('2026-03-10T14:00:00.000Z');
    expect(result.slots).not.toContain('2026-03-10T13:00:00.000Z');
    expect(result.slots).not.toContain('2026-03-10T17:00:00.000Z');

    vi.useRealTimers();
  });

  it('treats pending requests as unavailable time for a specifically selected staff member', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      fullName: 'Andy',
      workDays: [2],
      serviceAssignments: [],
    } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        startTime: new Date('2026-03-10T14:00:00.000Z'),
        endTime: new Date('2026-03-10T15:00:00.000Z'),
        status: 'pending',
      },
    ] as any);

    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test-salon' },
      date: '2026-03-10',
      serviceId: 'svc-1',
      staffId: 'stf-1',
    });

    expect(result.unavailableSlots).toContain('2026-03-10T14:00:00.000Z');
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          staffId: 'stf-1',
          status: { in: ['pending', 'scheduled', 'confirmed'] },
        }),
      })
    );

    vi.useRealTimers();
  });

  it('does not block slots from other staff when the customer chooses anyone available', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test-salon' },
      date: '2026-03-10',
      serviceId: 'svc-1',
      staffId: 'anyone',
    });

    expect(result.slots).toContain('2026-03-10T14:00:00.000Z');
    expect(prisma.staff.findFirst).not.toHaveBeenCalled();
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('checks consecutive per-service staff assignments against each staff member’s own segment', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: 'svc-gel', name: 'Gel Manicure', duration: 60 },
      { id: 'svc-pedi', name: 'Pedicure', duration: 60 },
    ] as any);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      {
        id: 'staff-a',
        fullName: 'Anna',
        workDays: [2],
        workHours: {},
        serviceAssignments: [{ serviceId: 'svc-gel' }],
      },
      {
        id: 'staff-b',
        fullName: 'Bella',
        workDays: [2],
        workHours: {},
        serviceAssignments: [{ serviceId: 'svc-pedi' }],
      },
    ] as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        staffId: 'staff-b',
        startTime: new Date('2026-03-10T14:00:00.000Z'),
        endTime: new Date('2026-03-10T14:30:00.000Z'),
      },
    ] as any);

    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test-salon' },
      date: '2026-03-10',
      serviceId: 'svc-gel',
      serviceIds: ['svc-gel', 'svc-pedi'],
      serviceStaffAssignments: [
        { serviceId: 'svc-gel', staffId: 'staff-a' },
        { serviceId: 'svc-pedi', staffId: 'staff-b' },
      ],
    });

    expect(result.unavailableSlots).toContain('2026-03-10T13:00:00.000Z');
    expect(result.slots).toContain('2026-03-10T14:30:00.000Z');
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          staffId: { in: ['staff-a', 'staff-b'] },
        }),
      })
    );

    vi.useRealTimers();
  });

  it('rejects per-service assignment slots when a selected employee cannot perform that service', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: 'svc-gel', name: 'Gel Manicure', duration: 45 },
      { id: 'svc-pedi', name: 'Pedicure', duration: 60 },
    ] as any);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      {
        id: 'staff-a',
        fullName: 'Anna',
        workDays: [2],
        workHours: {},
        serviceAssignments: [{ serviceId: 'svc-gel' }],
      },
    ] as any);

    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test-salon' },
      date: '2026-03-10',
      serviceId: 'svc-gel',
      serviceIds: ['svc-gel', 'svc-pedi'],
      serviceStaffAssignments: [
        { serviceId: 'svc-gel', staffId: 'staff-a' },
        { serviceId: 'svc-pedi', staffId: 'staff-a' },
      ],
    });

    expect(result).toMatchObject({
      slots: [],
      unavailableSlots: [],
      availabilityReason: 'staff_cant_do_service',
      message: 'Anna does not perform one of the selected services.',
    });

    vi.useRealTimers();
  });
});
