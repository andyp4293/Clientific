import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    staff: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/utils', () => ({
  verifyPassword: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/utils';
import { authenticateStaffCredentials, StaffAuthError } from './staff-auth';

const mockFindStaff = vi.mocked(prisma.staff.findMany);
const mockVerifyPassword = vi.mocked(verifyPassword);

beforeEach(() => {
  vi.clearAllMocks();
  mockFindStaff.mockResolvedValue([
    {
      id: 'staff-1',
      fullName: 'Taylor Nguyen',
      email: 'taylor@example.com',
      portalPasswordHash: 'hashed-password',
      portalPasswordSetAt: new Date('2026-04-01T12:00:00Z'),
      active: true,
      portalAccessEnabled: true,
      businessId: 'biz-1',
      business: {
        id: 'biz-1',
        email: 'owner@clientific.app',
        name: 'Clientific Studio',
      },
    },
  ] as never);
  mockVerifyPassword.mockResolvedValue(true);
});

describe('authenticateStaffCredentials', () => {
  it('authenticates an active staff member with appointment-only access', async () => {
    const staff = await authenticateStaffCredentials({
      email: ' Taylor@Example.com ',
      password: 'temporary123',
    });

    expect(mockFindStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { equals: 'taylor@example.com', mode: 'insensitive' },
          active: true,
          portalAccessEnabled: true,
        }),
      }),
    );
    expect(staff).toEqual(
      expect.objectContaining({
        accountType: 'staff',
        businessId: 'biz-1',
        staffId: 'staff-1',
        staffName: 'Taylor Nguyen',
        businessName: 'Clientific Studio',
        onboardingComplete: true,
        passwordChangeRequired: false,
      }),
    );
  });

  it('authenticates a temporary staff password but requires first-login password setup', async () => {
    mockFindStaff.mockResolvedValue([
      {
        id: 'staff-1',
        fullName: 'Taylor Nguyen',
        email: 'taylor@example.com',
        portalPasswordHash: 'hashed-password',
        portalPasswordSetAt: null,
        active: true,
        portalAccessEnabled: true,
        businessId: 'biz-1',
        business: {
          id: 'biz-1',
          email: 'owner@clientific.app',
          name: 'Clientific Studio',
        },
      },
    ] as never);

    const staff = await authenticateStaffCredentials({
      email: 'taylor@example.com',
      password: 'temporary123',
    });

    expect(staff).toEqual(
      expect.objectContaining({
        onboardingComplete: false,
        passwordChangeRequired: true,
      }),
    );
  });

  it('rejects ambiguous staff emails instead of guessing a business', async () => {
    mockFindStaff.mockResolvedValue([
      { id: 'staff-1', portalPasswordHash: 'one' },
      { id: 'staff-2', portalPasswordHash: 'two' },
    ] as never);

    await expect(
      authenticateStaffCredentials({
        email: 'shared@example.com',
        password: 'temporary123',
      }),
    ).rejects.toMatchObject({
      code: 'AMBIGUOUS_EMAIL',
      status: 401,
    } satisfies Partial<StaffAuthError>);
  });

  it('rejects staff accounts without a portal password', async () => {
    mockFindStaff.mockResolvedValue([
      {
        id: 'staff-1',
        fullName: 'Taylor Nguyen',
        email: 'taylor@example.com',
        portalPasswordHash: null,
        portalPasswordSetAt: null,
        active: true,
        portalAccessEnabled: true,
        businessId: 'biz-1',
        business: {
          id: 'biz-1',
          email: 'owner@clientific.app',
          name: 'Clientific Studio',
        },
      },
    ] as never);

    await expect(
      authenticateStaffCredentials({
        email: 'taylor@example.com',
        password: 'temporary123',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    } satisfies Partial<StaffAuthError>);
  });
});
