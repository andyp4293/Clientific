import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    serviceGroup: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindGroups = prisma.serviceGroup.findMany as ReturnType<typeof vi.fn>;
const mockUpdateGroup = prisma.serviceGroup.update as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
  mockUpdateGroup.mockResolvedValue({});
  mockTransaction.mockResolvedValue([]);
});

describe('POST /api/mobile/service-groups/reorder', () => {
  it('reorders service groups for the native app', async () => {
    mockFindGroups.mockResolvedValue([{ id: 'group-1' }, { id: 'group-2' }]);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/service-groups/reorder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: ['group-2', 'group-1'] }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockUpdateGroup).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: 'group-2' }, data: { sortOrder: 0 } }),
    );
    expect(mockUpdateGroup).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: 'group-1' }, data: { sortOrder: 1 } }),
    );
  });
});
