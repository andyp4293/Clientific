import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    service: { findMany: vi.fn() },
    staff: { findFirst: vi.fn() },
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
      businessHours: {
        hours: dayHours,
      },
    } as any);
    vi.mocked(prisma.service.findMany).mockResolvedValue([{ id: 'svc-1', duration: 60 }] as any);
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
});
