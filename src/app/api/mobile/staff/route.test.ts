import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
  checkPlanLimit: vi.fn().mockResolvedValue({
    allowed: true,
    current: 1,
    limit: 10,
  }),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    businessHours: {
      findUnique: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/utils', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));
vi.mock('@/lib/email', () => ({
  sendStaffTemporaryPasswordEmail: vi.fn(),
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { sendStaffTemporaryPasswordEmail } from '@/lib/email';
import { POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindBusinessHours = prisma.businessHours.findUnique as ReturnType<typeof vi.fn>;
const mockFindServices = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const mockSendStaffTemporaryPasswordEmail = vi.mocked(sendStaffTemporaryPasswordEmail);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({
    session: { businessId: 'biz-1', name: 'Clientific Studio' },
  });
});

describe('POST /api/mobile/staff', () => {
  it('creates staff and returns the formatted mobile record', async () => {
    const staffCreate = vi.fn().mockResolvedValue({ id: 'staff-1' });
    const staffFindUniqueOrThrow = vi.fn().mockResolvedValue({
      id: 'staff-1',
      fullName: 'Taylor',
      email: 'taylor@example.com',
      phone: '+15557654321',
      role: 'Stylist',
      bio: 'Gel specialist who keeps appointments calm and efficient.',
      active: true,
      portalAccessEnabled: true,
      portalPasswordHash: 'hashed:temporary123',
      portalPasswordSetAt: null,
      workDays: [1],
      workHours: { 1: { startTime: '09:00', endTime: '17:00' } },
      serviceAssignments: [{ serviceId: 'svc-1' }],
    });

    mockFindBusinessHours.mockResolvedValue({
      hours: {
        1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
    });
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        staff: {
          create: staffCreate,
          findUniqueOrThrow: staffFindUniqueOrThrow,
        },
        staffService: {
          createMany: vi.fn().mockResolvedValue(undefined),
        },
      }),
    );
    mockFindServices.mockResolvedValue([{ id: 'svc-1', name: 'Haircut' }]);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/staff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Taylor',
          email: 'taylor@example.com',
          phone: '(555) 765-4321',
          role: 'Stylist',
          bio: '  Gel specialist who keeps appointments calm and efficient.  ',
          portalAccessEnabled: true,
          serviceIds: ['svc-1'],
          workDays: [1],
          workHours: { 1: { startTime: '09:00', endTime: '17:00' } },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(staffCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'taylor@example.com',
        portalAccessEnabled: true,
        portalPasswordHash: expect.any(String),
        portalPasswordSetAt: null,
      }),
    });
    expect(mockSendStaffTemporaryPasswordEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'taylor@example.com',
        businessName: 'Clientific Studio',
        temporaryPassword: expect.any(String),
      }),
    );
    const body = await response.json();
    expect(body.staff).toMatchObject({
      id: 'staff-1',
      fullName: 'Taylor',
      phoneDisplay: '(555) 765-4321',
      bio: 'Gel specialist who keeps appointments calm and efficient.',
      portalAccessEnabled: true,
      hasPortalPassword: true,
      passwordChangeRequired: true,
      serviceNames: ['Haircut'],
    });
  });
});
