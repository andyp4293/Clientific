import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
  checkPlanLimit: vi.fn().mockResolvedValue({
    allowed: true,
    current: 1,
    limit: 20,
  }),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    serviceGroup: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    service: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    staff: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET, POST } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindGroups = prisma.serviceGroup.findMany as ReturnType<typeof vi.fn>;
const mockFindServiceGroup = prisma.serviceGroup.findFirst as ReturnType<typeof vi.fn>;
const mockFindServices = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockAggregateServices = prisma.service.aggregate as ReturnType<typeof vi.fn>;
const mockCreateService = prisma.service.create as ReturnType<typeof vi.fn>;
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
      price: 45,
      durationLabel: '45 min',
      priceLabel: '$45.00',
      groupName: 'Hair',
    });
    expect(body.staff[0]).toMatchObject({
      id: 'staff-1',
      fullName: 'Taylor',
      phone: '+15557654321',
      phoneDisplay: '(555) 765-4321',
      workDays: [1, 2, 3],
      serviceIds: ['svc-1'],
      serviceNames: ['Haircut'],
    });
  });
});

describe('POST /api/mobile/services', () => {
  it('creates a service for the native app and returns the formatted record', async () => {
    mockAggregateServices.mockResolvedValue({ _max: { sortOrder: 3 } });
    mockFindServiceGroup.mockResolvedValue({ id: 'group-1' });
    mockCreateService.mockResolvedValue({
      id: 'svc-9',
      name: 'Gel manicure',
      description: 'Gloss finish',
      duration: 75,
      price: 55,
      active: true,
      groupId: 'group-1',
      sortOrder: 4,
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/services', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Gel manicure',
          description: 'Gloss finish',
          duration: 75,
          price: 55,
          isActive: true,
          groupId: 'group-1',
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.service).toMatchObject({
      id: 'svc-9',
      name: 'Gel manicure',
      durationLabel: '1 hr 15 min',
      priceLabel: '$55.00',
      isActive: true,
    });
    expect(mockCreateService).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          name: 'Gel manicure',
          duration: 75,
          price: 55,
        }),
      }),
    );
  });
});
