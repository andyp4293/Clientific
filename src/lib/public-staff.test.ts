import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    staff: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getPublicStaff } from './public-staff';

const mockFindStaff = prisma.staff.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPublicStaff', () => {
  it('returns optional staff bios in public booking payloads', async () => {
    mockFindStaff.mockResolvedValue([
      {
        id: 'staff-1',
        fullName: 'Taylor',
        role: 'Lead stylist',
        bio: 'Known for calm consultations and detailed gel work.',
        serviceAssignments: [],
      },
    ]);

    const staff = await getPublicStaff({ businessId: 'biz-1' });

    expect(staff).toEqual([
      {
        id: 'staff-1',
        fullName: 'Taylor',
        role: 'Lead stylist',
        bio: 'Known for calm consultations and detailed gel work.',
        serviceIds: [],
      },
    ]);
  });

  it('keeps all-service staff bookable when filtering by selected services', async () => {
    mockFindStaff.mockResolvedValue([
      {
        id: 'staff-all',
        fullName: 'Morgan',
        role: 'Team member',
        bio: null,
        serviceAssignments: [],
      },
      {
        id: 'staff-other',
        fullName: 'Riley',
        role: 'Team member',
        bio: null,
        serviceAssignments: [{ serviceId: 'svc-other' }],
      },
    ]);

    const staff = await getPublicStaff({ businessId: 'biz-1', requiredServiceIds: ['svc-1'] });

    expect(staff.map((member) => member.id)).toEqual(['staff-all']);
  });
});
