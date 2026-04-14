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
      aggregate: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockAggregateGroups = prisma.serviceGroup.aggregate as ReturnType<typeof vi.fn>;
const mockCreateGroup = prisma.serviceGroup.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
});

describe('POST /api/mobile/service-groups', () => {
  it('creates a service group for the native app', async () => {
    mockAggregateGroups.mockResolvedValue({ _max: { sortOrder: 2 } });
    mockCreateGroup.mockResolvedValue({
      id: 'group-3',
      name: 'Pedicures',
      sortOrder: 3,
      _count: { services: 0 },
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/service-groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Pedicures' }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      group: {
        id: 'group-3',
        name: 'Pedicures',
        sortOrder: 3,
        servicesCount: 0,
      },
    });
    expect(mockCreateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          name: 'Pedicures',
          sortOrder: 3,
        }),
      }),
    );
  });
});
