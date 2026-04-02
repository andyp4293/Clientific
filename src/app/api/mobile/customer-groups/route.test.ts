import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerGroup: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { GET, POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.customerGroup.findFirst as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.customerGroup.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.customerGroup.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
});

describe('GET /api/mobile/customer-groups', () => {
  it('returns mobile customer groups with membership counts', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'group-1',
        name: 'VIP',
        promotionSmsEnabled: true,
        _count: { memberships: 8 },
      },
    ]);

    const response = await GET(new Request('https://www.clientific.app/api/mobile/customer-groups'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.groups[0]).toMatchObject({
      id: 'group-1',
      name: 'VIP',
      membersCount: 8,
    });
  });
});

describe('POST /api/mobile/customer-groups', () => {
  it('creates a group and returns the formatted mobile payload', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: 'group-1',
      name: 'VIP',
      promotionSmsEnabled: true,
      _count: { memberships: 0 },
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/customer-groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'VIP' }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.group).toMatchObject({
      id: 'group-1',
      name: 'VIP',
      membersCount: 0,
    });
  });
});
