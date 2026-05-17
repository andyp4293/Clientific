import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  calculateExtendedAccessDate,
  extendBusinessAccessByExactName,
  getAccessExtensionUpdate,
} from './business-access-extension';

const mockFindMany = vi.mocked(prisma.business.findMany);
const mockUpdate = vi.mocked(prisma.business.update);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('calculateExtendedAccessDate', () => {
  it('adds days from the latest active access date', () => {
    const result = calculateExtendedAccessDate({
      now: new Date('2026-05-17T00:00:00.000Z'),
      trialEndsAt: new Date('2026-06-01T00:00:00.000Z'),
      subscriptionCurrentPeriodEnd: new Date('2026-05-25T00:00:00.000Z'),
      days: 100,
    });

    expect(result.toISOString()).toBe('2026-09-09T00:00:00.000Z');
  });

  it('starts from now when existing access is missing or expired', () => {
    const result = calculateExtendedAccessDate({
      now: new Date('2026-05-17T00:00:00.000Z'),
      trialEndsAt: new Date('2026-04-01T00:00:00.000Z'),
      subscriptionCurrentPeriodEnd: null,
      days: 100,
    });

    expect(result.toISOString()).toBe('2026-08-25T00:00:00.000Z');
  });
});

describe('getAccessExtensionUpdate', () => {
  it('extends the paid period field when the account is active', () => {
    expect(
      getAccessExtensionUpdate(
        {
          subscriptionStatus: 'active',
          subscriptionCurrentPeriodEnd: null,
        },
        new Date('2026-08-28T00:00:00.000Z'),
      ),
    ).toEqual({
      subscriptionCurrentPeriodEnd: new Date('2026-08-28T00:00:00.000Z'),
    });
  });

  it('uses a trial extension for inactive or trial accounts', () => {
    expect(
      getAccessExtensionUpdate(
        { subscriptionStatus: 'inactive', subscriptionCurrentPeriodEnd: null },
        new Date('2026-08-25T00:00:00.000Z'),
      ),
    ).toEqual({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date('2026-08-25T00:00:00.000Z'),
    });
  });
});

describe('extendBusinessAccessByExactName', () => {
  it('refuses to update when the exact business name is not found', async () => {
    mockFindMany.mockResolvedValue([]);

    await expect(
      extendBusinessAccessByExactName('business test purchases', 100, new Date()),
    ).resolves.toEqual({ status: 'not_found', matches: [] });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates exactly one matching business', async () => {
    const before = {
      id: 'biz-1',
      name: 'business test purchases',
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date('2026-05-20T00:00:00.000Z'),
      subscriptionCurrentPeriodEnd: null,
    };
    const after = {
      ...before,
      trialEndsAt: new Date('2026-08-28T00:00:00.000Z'),
    };
    mockFindMany.mockResolvedValue([before]);
    mockUpdate.mockResolvedValue(after);

    await expect(
      extendBusinessAccessByExactName(
        'business test purchases',
        100,
        new Date('2026-05-17T00:00:00.000Z'),
      ),
    ).resolves.toMatchObject({
      status: 'updated',
      businessId: 'biz-1',
      extendedUntil: new Date('2026-08-28T00:00:00.000Z'),
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: {
          subscriptionStatus: 'trialing',
          trialEndsAt: new Date('2026-08-28T00:00:00.000Z'),
        },
      }),
    );
  });
});
