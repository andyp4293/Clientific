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
    service: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindServices = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockUpdateService = prisma.service.update as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
  mockUpdateService.mockResolvedValue({});
  mockTransaction.mockResolvedValue([]);
});

describe('POST /api/mobile/services/reorder', () => {
  it('reorders services for the native app', async () => {
    mockFindServices.mockResolvedValue([{ id: 'svc-1' }, { id: 'svc-2' }]);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/services/reorder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: ['svc-2', 'svc-1'] }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockUpdateService).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: 'svc-2' }, data: { sortOrder: 0 } }),
    );
    expect(mockUpdateService).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: 'svc-1' }, data: { sortOrder: 1 } }),
    );
  });
});
