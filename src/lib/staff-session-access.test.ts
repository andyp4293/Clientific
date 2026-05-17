import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    staff: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getStaffSessionAccess } from './staff-session-access';

const mockFindFirst = vi.mocked(prisma.staff.findFirst);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getStaffSessionAccess', () => {
  it('allows active staff with employee login enabled', async () => {
    mockFindFirst.mockResolvedValue({
      fullName: 'Taylor',
      portalAccessEnabled: true,
      portalPasswordHash: 'hashed-password',
      portalPasswordSetAt: new Date('2026-05-01T12:00:00.000Z'),
    } as never);

    await expect(
      getStaffSessionAccess({ staffId: 'staff-1', businessId: 'biz-1' }),
    ).resolves.toEqual({
      allowed: true,
      passwordChangeRequired: false,
      staffName: 'Taylor',
    });
  });

  it('denies active sessions after employee login is disabled', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      getStaffSessionAccess({ staffId: 'staff-1', businessId: 'biz-1' }),
    ).resolves.toEqual({ allowed: false });
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'staff-1',
          businessId: 'biz-1',
          active: true,
          portalAccessEnabled: true,
        }),
      }),
    );
  });
});
