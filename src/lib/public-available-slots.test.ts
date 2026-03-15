import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    staff: { findUnique: vi.fn() },
    appointment: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { getPublicAvailableSlots } from './public-available-slots';

describe('public available slots helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      enableOnlineBooking: true,
      timezone: 'America/New_York',
      businessHours: {
        hours: {
          '0': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        },
      },
    } as any);
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ duration: 60 } as any);
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ workDays: [1, 2, 3, 4, 5] } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
  });

  it('returns a dedicated staff-off reason when the selected staff member is off that day', async () => {
    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test-salon' },
      date: '2026-03-15',
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
});
