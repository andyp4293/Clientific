import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    serviceGroup: {
      delete: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { DELETE, PATCH } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindGroup = prisma.serviceGroup.findFirst as ReturnType<typeof vi.fn>;
const mockUpdateGroup = prisma.serviceGroup.update as ReturnType<typeof vi.fn>;
const mockDeleteGroup = prisma.serviceGroup.delete as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
});

describe('PATCH /api/mobile/service-groups/[id]', () => {
  it('renames a service group for the native app', async () => {
    mockFindGroup.mockResolvedValue({ id: 'group-1' });
    mockUpdateGroup.mockResolvedValue({
      id: 'group-1',
      name: 'Hands',
      sortOrder: 0,
      _count: { services: 2 },
    });

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/service-groups/group-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Hands' }),
      }),
      { params: Promise.resolve({ id: 'group-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      group: {
        id: 'group-1',
        name: 'Hands',
        servicesCount: 2,
      },
    });
  });
});

describe('DELETE /api/mobile/service-groups/[id]', () => {
  it('deletes a service group for the native app', async () => {
    mockFindGroup.mockResolvedValue({ id: 'group-1' });
    mockDeleteGroup.mockResolvedValue({ id: 'group-1' });

    const response = await DELETE(
      new Request('https://www.clientific.app/api/mobile/service-groups/group-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'group-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockDeleteGroup).toHaveBeenCalledWith({ where: { id: 'group-1' } });
  });
});
