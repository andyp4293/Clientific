/**
 * Unit tests for the getPublicStaff helper.
 * Tests the service-filtering logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    staff: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';

const ALL_STAFF = [
  {
    id: 's1',
    fullName: 'Alice',
    role: 'stylist',
    serviceAssignments: [],                                       // no restrictions
  },
  {
    id: 's2',
    fullName: 'Bob',
    role: null,
    serviceAssignments: [{ serviceId: 'svc-cut' }, { serviceId: 'svc-color' }],
  },
  {
    id: 's3',
    fullName: 'Carol',
    role: null,
    serviceAssignments: [{ serviceId: 'svc-massage' }],
  },
];

describe('getPublicStaff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.staff.findMany).mockResolvedValue(ALL_STAFF as any);
  });

  it('returns all staff when requiredServiceIds is empty', async () => {
    const { getPublicStaff } = await import('@/lib/public-staff');
    const result = await getPublicStaff({ businessId: 'biz-1' });
    expect(result).toHaveLength(3);
  });

  it('returns unrestricted staff + those matching single serviceId', async () => {
    const { getPublicStaff } = await import('@/lib/public-staff');
    const result = await getPublicStaff({ businessId: 'biz-1', requiredServiceIds: ['svc-cut'] });
    const ids = result.map((s) => s.id);
    expect(ids).toContain('s1'); // no restrictions
    expect(ids).toContain('s2'); // has svc-cut
    expect(ids).not.toContain('s3'); // only has svc-massage
  });

  it('requires ALL serviceIds for multi-service selection', async () => {
    const { getPublicStaff } = await import('@/lib/public-staff');
    const result = await getPublicStaff({
      businessId: 'biz-1',
      requiredServiceIds: ['svc-cut', 'svc-color'],
    });
    const ids = result.map((s) => s.id);
    expect(ids).toContain('s1'); // no restrictions
    expect(ids).toContain('s2'); // has both
    expect(ids).not.toContain('s3'); // only has svc-massage
  });

  it('only returns unrestricted staff when no one has the required service', async () => {
    const { getPublicStaff } = await import('@/lib/public-staff');
    const result = await getPublicStaff({
      businessId: 'biz-1',
      requiredServiceIds: ['svc-nonexistent'],
    });
    const ids = result.map((s) => s.id);
    expect(ids).toEqual(['s1']); // only the unrestricted one
  });

  it('strips serviceAssignments from returned objects', async () => {
    const { getPublicStaff } = await import('@/lib/public-staff');
    const result = await getPublicStaff({ businessId: 'biz-1' });
    result.forEach((member) => {
      expect(member).not.toHaveProperty('serviceAssignments');
    });
  });

  it('passes businessId to prisma correctly', async () => {
    const { getPublicStaff } = await import('@/lib/public-staff');
    await getPublicStaff({ businessId: 'my-biz' });
    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: 'my-biz', active: true }),
      })
    );
  });
});
