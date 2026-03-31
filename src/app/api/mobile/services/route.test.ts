import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    serviceGroup: {
      findMany: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    staff: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindGroups = prisma.serviceGroup.findMany as ReturnType<typeof vi.fn>;
const mockFindServices = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockFindStaff = prisma.staff.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
});

describe('GET /api/mobile/services', () => {
  it('returns service, group, and staff summaries for the native app', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
    });
    mockFindGroups.mockResolvedValue([
      { id: 'group-1', name: 'Hair', sortOrder: 0, createdAt: new Date(), _count: { services: 2 } },
    ]);
    mockFindServices.mockResolvedValue([
      {
        id: 'svc-1',
        name: 'Haircut',
        description: 'Classic cut',
        duration: 45,
        price: 45,
        active: true,
        groupId: 'group-1',
        sortOrder: 0,
        createdAt: new Date(),
      },
    ]);
    mockFindStaff.mockResolvedValue([
      {
        id: 'staff-1',
        fullName: 'Taylor',
        email: 'taylor@example.com',
        phone: '+15557654321',
        role: 'Stylist',
        active: true,
        workDays: [1, 2, 3],
        workHours: {
          1: { startTime: '09:00', endTime: '17:00' },
          2: { startTime: '09:00', endTime: '17:00' },
        },
        serviceAssignments: [{ serviceId: 'svc-1' }],
      },
    ]);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/services', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.counts).toMatchObject({
      services: 1,
      activeServices: 1,
      staff: 1,
      activeStaff: 1,
    });
    expect(body.groups[0]).toMatchObject({
      id: 'group-1',
      name: 'Hair',
      servicesCount: 2,
    });
    expect(body.services[0]).toMatchObject({
      id: 'svc-1',
      name: 'Haircut',
      durationLabel: '45 min',
      priceLabel: '$45.00',
      groupName: 'Hair',
    });
    expect(body.staff[0]).toMatchObject({
      id: 'staff-1',
      fullName: 'Taylor',
      phoneDisplay: '(555) 765-4321',
      serviceNames: ['Haircut'],
    });
  });
});
