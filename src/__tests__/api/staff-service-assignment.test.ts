/**
 * Comprehensive tests for the Staff ↔ Service assignment feature.
 *
 * Covers:
 *  1. Staff API GET  — serviceIds included in response
 *  2. Staff API POST — serviceIds stored on create
 *  3. Staff API PATCH — serviceIds replaced atomically
 *  4. PATCH with no serviceIds in body — assignments untouched
 *  5. validateStaffCanPerformServices helper
 *  6. public-available-slots: staff_cant_do_service reason
 *  7. public book route: rejects booking when staff can't do service
 *  8. public staff route: filters by serviceIds param
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock next-auth
// ---------------------------------------------------------------------------
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    businessHours: { findUnique: vi.fn() },
    staff: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    staffService: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    service: { findUnique: vi.fn(), findMany: vi.fn() },
    appointment: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
    smsConsentEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
  checkPlanLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: 10 }),
}));

vi.mock('@/lib/moderation', () => ({
  getBlockedFieldLabel: vi.fn().mockReturnValue(null),
  blockedContentError: vi.fn((f: string) => `${f} contains disallowed content`),
}));

vi.mock('@/lib/twilio', () => ({
  sendAppointmentConfirmation: vi.fn().mockResolvedValue({ success: true }),
  formatPhoneNumber: vi.fn((p: string) => p),
}));

vi.mock('@/lib/email', () => ({
  sendNewBookingEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn().mockReturnValue('https://clientific.app'),
}));

// NOTE: @/lib/public-available-slots is NOT mocked — section 7 tests call the real
// implementation with Prisma mocked, so the actual filtering logic is exercised.

// ---------------------------------------------------------------------------
// Import mocked modules AFTER vi.mock declarations
// ---------------------------------------------------------------------------
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SESSION = { user: { id: 'biz-1' } };

const STAFF_DB = {
  id: 'staff-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  businessId: 'biz-1',
  fullName: 'Alice',
  email: null,
  phone: null,
  role: 'stylist',
  active: true,
  workDays: [1, 2, 3, 4, 5],
  serviceAssignments: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }],
};

const STAFF_DB_NO_RESTRICTIONS = {
  ...STAFF_DB,
  id: 'staff-2',
  fullName: 'Bob',
  serviceAssignments: [],
};

// ---------------------------------------------------------------------------
// 1. Staff API — GET returns serviceIds
// ---------------------------------------------------------------------------
describe('GET /api/staff — includes serviceIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
  });

  it('maps serviceAssignments to flat serviceIds array', async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([STAFF_DB] as any);
    const { GET } = await import('@/app/api/staff/route');
    const res = await GET(new NextRequest('http://localhost/api/staff'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.staff[0].serviceIds).toEqual(['svc-1', 'svc-2']);
    expect(body.staff[0].isActive).toBe(true);
  });

  it('returns empty serviceIds for staff with no restrictions', async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([STAFF_DB_NO_RESTRICTIONS] as any);
    const { GET } = await import('@/app/api/staff/route');
    const res = await GET(new NextRequest('http://localhost/api/staff'));
    const body = await res.json();
    expect(body.staff[0].serviceIds).toEqual([]);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { GET } = await import('@/app/api/staff/route');
    const res = await GET(new NextRequest('http://localhost/api/staff'));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2 & 3. Staff API — PATCH replaces serviceIds atomically
// ---------------------------------------------------------------------------
describe('PATCH /api/staff/[id] — service assignment replacement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({
      id: 'staff-1',
      businessId: 'biz-1',
    } as any);
  });

  it('replaces service assignments when serviceIds present', async () => {
    const newServiceIds = ['svc-3', 'svc-4'];

    // $transaction should execute the callback and return updated staff
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const txPrisma = {
        staff: {
          update: vi.fn().mockResolvedValue({ id: 'staff-1', active: true }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...STAFF_DB,
            serviceAssignments: newServiceIds.map((s) => ({ serviceId: s })),
          }),
        },
        staffService: {
          deleteMany: vi.fn().mockResolvedValue({}),
          createMany: vi.fn().mockResolvedValue({}),
        },
      };
      const result = await fn(txPrisma);
      expect(txPrisma.staffService.deleteMany).toHaveBeenCalledWith({ where: { staffId: 'staff-1' } });
      expect(txPrisma.staffService.createMany).toHaveBeenCalledWith({
        data: newServiceIds.map((serviceId) => ({ staffId: 'staff-1', serviceId })),
        skipDuplicates: true,
      });
      return result;
    });

    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const res = await PATCH(
      new NextRequest('http://localhost/api/staff/staff-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Alice', serviceIds: newServiceIds, isActive: true }),
      }),
      { params: Promise.resolve({ id: 'staff-1' }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.staff.serviceIds).toEqual(newServiceIds);
  });

  it('clears all assignments when serviceIds is empty array', async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const txPrisma = {
        staff: {
          update: vi.fn().mockResolvedValue({ id: 'staff-1', active: true }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...STAFF_DB,
            serviceAssignments: [],
          }),
        },
        staffService: {
          deleteMany: vi.fn().mockResolvedValue({}),
          createMany: vi.fn().mockResolvedValue({}),
        },
      };
      const result = await fn(txPrisma);
      expect(txPrisma.staffService.deleteMany).toHaveBeenCalledWith({ where: { staffId: 'staff-1' } });
      // createMany NOT called since array is empty
      expect(txPrisma.staffService.createMany).not.toHaveBeenCalled();
      return result;
    });

    const { PATCH } = await import('@/app/api/staff/[id]/route');
    await PATCH(
      new NextRequest('http://localhost/api/staff/staff-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Alice', serviceIds: [], isActive: true }),
      }),
      { params: Promise.resolve({ id: 'staff-1' }) }
    );
  });

  it('leaves assignments untouched when serviceIds absent from body', async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const txPrisma = {
        staff: {
          update: vi.fn().mockResolvedValue({ id: 'staff-1', active: true }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(STAFF_DB),
        },
        staffService: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
      };
      const result = await fn(txPrisma);
      // Neither delete nor create should be called
      expect(txPrisma.staffService.deleteMany).not.toHaveBeenCalled();
      expect(txPrisma.staffService.createMany).not.toHaveBeenCalled();
      return result;
    });

    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const res = await PATCH(
      new NextRequest('http://localhost/api/staff/staff-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // No serviceIds key in body
        body: JSON.stringify({ fullName: 'Alice', isActive: true }),
      }),
      { params: Promise.resolve({ id: 'staff-1' }) }
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 when staff belongs to different business', async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({
      id: 'staff-1',
      businessId: 'other-biz',
    } as any);

    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const res = await PATCH(
      new NextRequest('http://localhost/api/staff/staff-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Alice', isActive: true }),
      }),
      { params: Promise.resolve({ id: 'staff-1' }) }
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 4. validateStaffCanPerformServices helper
// ---------------------------------------------------------------------------
describe('validateStaffCanPerformServices', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when staff has no restrictions', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      serviceAssignments: [],
    } as any);
    const { validateStaffCanPerformServices } = await import(
      '@/lib/staff-service-validation'
    );
    const result = await validateStaffCanPerformServices({
      staffId: 'staff-1',
      businessId: 'biz-1',
      serviceIds: ['svc-1', 'svc-2'],
    });
    expect(result).toBeNull();
  });

  it('returns null when staff can perform all requested services', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      serviceAssignments: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }],
    } as any);
    const { validateStaffCanPerformServices } = await import(
      '@/lib/staff-service-validation'
    );
    const result = await validateStaffCanPerformServices({
      staffId: 'staff-1',
      businessId: 'biz-1',
      serviceIds: ['svc-1'],
    });
    expect(result).toBeNull();
  });

  it('returns 400 error when staff cannot perform one service', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      serviceAssignments: [{ serviceId: 'svc-1' }],
    } as any);
    const { validateStaffCanPerformServices } = await import(
      '@/lib/staff-service-validation'
    );
    const result = await validateStaffCanPerformServices({
      staffId: 'staff-1',
      businessId: 'biz-1',
      serviceIds: ['svc-1', 'svc-99'],
    });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(result!.error).toMatch(/cannot perform/i);
  });

  it('returns 404 when staff not found or wrong business', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null);
    const { validateStaffCanPerformServices } = await import(
      '@/lib/staff-service-validation'
    );
    const result = await validateStaffCanPerformServices({
      staffId: 'staff-ghost',
      businessId: 'biz-1',
      serviceIds: ['svc-1'],
    });
    expect(result!.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 5. Public book route rejects staff/service mismatch
// ---------------------------------------------------------------------------
describe('POST /api/public/business/[slug]/book — staff-service validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      enableOnlineBooking: true,
      email: 'owner@test.com',
      name: 'Test Salon',
      timezone: 'America/New_York',
      notifyNewBookingEmail: false,
      vapiPhoneNumber: null,
      businessHours: {
        hours: {
          '0': { isOpen: false, openTime: null, closeTime: null },
          '1': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          '2': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          '3': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          '4': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          '5': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          '6': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        },
      },
      closureDates: [],
    } as any);
    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: 'svc-1', name: 'Cut' },
      { id: 'svc-2', name: 'Color' },
    ] as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customer.create).mockResolvedValue({
      id: 'cust-1',
      name: 'Jane',
      phone: '+15551234567',
      smsOptedOut: false,
    } as any);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: 'appt-1',
      startTime: new Date(),
      duration: 60,
      customer: { id: 'cust-1', name: 'Jane', phone: '+15551234567' },
      service: { name: 'Cut' },
      staff: { fullName: 'Alice' },
      business: { name: 'Test Salon' },
    } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'n1' } as any);
  });

  const bookingBody = {
    serviceIds: ['svc-1', 'svc-2'],
    staffId: 'staff-1',
    startTime: '2026-06-10T14:00:00.000Z',
    duration: 60,
    customerName: 'Jane',
    customerPhone: '+15551234567',
  };

  it('rejects (400) when staff cannot perform a selected service', async () => {
    // Staff is restricted to svc-1 only
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Alice',
      workDays: [1, 2, 3, 4, 5],
      serviceAssignments: [{ serviceId: 'svc-1' }],
    } as any);

    const { POST } = await import('@/app/api/public/business/[slug]/book/route');
    const res = await POST(
      new NextRequest('http://localhost/api/public/business/test/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingBody),
      }),
      { params: Promise.resolve({ slug: 'test' }) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cannot perform/i);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('allows booking when staff has no service restrictions', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Alice',
      workDays: [1, 2, 3, 4, 5],
      serviceAssignments: [],
    } as any);

    const { POST } = await import('@/app/api/public/business/[slug]/book/route');
    const res = await POST(
      new NextRequest('http://localhost/api/public/business/test/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingBody),
      }),
      { params: Promise.resolve({ slug: 'test' }) }
    );

    expect(res.status).toBe(200);
    expect(prisma.appointment.create).toHaveBeenCalled();
  });

  it('allows booking when staff can perform all selected services', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Alice',
      workDays: [1, 2, 3, 4, 5],
      serviceAssignments: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }],
    } as any);

    const { POST } = await import('@/app/api/public/business/[slug]/book/route');
    const res = await POST(
      new NextRequest('http://localhost/api/public/business/test/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingBody),
      }),
      { params: Promise.resolve({ slug: 'test' }) }
    );

    expect(res.status).toBe(200);
  });

  it('skips staff validation entirely when staffId is "anyone"', async () => {
    const { POST } = await import('@/app/api/public/business/[slug]/book/route');
    const res = await POST(
      new NextRequest('http://localhost/api/public/business/test/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bookingBody, staffId: 'anyone' }),
      }),
      { params: Promise.resolve({ slug: 'test' }) }
    );

    expect(res.status).toBe(200);
    // Staff lookup should NOT have been called for service-capability check
    expect(prisma.staff.findFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. Public staff route — filtering by serviceIds
// ---------------------------------------------------------------------------
describe('GET /api/public/business/[slug]/staff — serviceIds filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      enableOnlineBooking: true,
    } as any);
  });

  it('returns all active staff when no serviceIds param', async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 'staff-1', fullName: 'Alice', role: null, serviceAssignments: [] },
      { id: 'staff-2', fullName: 'Bob', role: null, serviceAssignments: [{ serviceId: 'svc-1' }] },
    ] as any);

    const { GET } = await import('@/app/api/public/business/[slug]/staff/route');
    const res = await GET(
      new NextRequest('http://localhost/api/public/business/test/staff'),
      { params: Promise.resolve({ slug: 'test' }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.staff).toHaveLength(2);
  });

  it('includes unrestricted staff (no assignments) when filtering by serviceId', async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 'staff-1', fullName: 'Alice', role: null, serviceAssignments: [] }, // no restrictions
      { id: 'staff-2', fullName: 'Bob', role: null, serviceAssignments: [{ serviceId: 'svc-1' }] }, // restricted to svc-1
      { id: 'staff-3', fullName: 'Carol', role: null, serviceAssignments: [{ serviceId: 'svc-99' }] }, // cannot do svc-1
    ] as any);

    const { GET } = await import('@/app/api/public/business/[slug]/staff/route');
    const res = await GET(
      new NextRequest('http://localhost/api/public/business/test/staff?serviceIds=svc-1'),
      { params: Promise.resolve({ slug: 'test' }) }
    );
    const body = await res.json();
    const ids = body.staff.map((s: any) => s.id);
    expect(ids).toContain('staff-1'); // no restrictions → included
    expect(ids).toContain('staff-2'); // has svc-1 → included
    expect(ids).not.toContain('staff-3'); // only svc-99 → excluded
  });

  it('requires ALL serviceIds to match for multi-service filtering', async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 'staff-1', fullName: 'Alice', role: null, serviceAssignments: [] }, // unrestricted
      {
        id: 'staff-2', fullName: 'Bob', role: null,
        serviceAssignments: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }], // has both
      },
      {
        id: 'staff-3', fullName: 'Carol', role: null,
        serviceAssignments: [{ serviceId: 'svc-1' }], // only svc-1
      },
    ] as any);

    const { GET } = await import('@/app/api/public/business/[slug]/staff/route');
    const res = await GET(
      new NextRequest('http://localhost/api/public/business/test/staff?serviceIds=svc-1,svc-2'),
      { params: Promise.resolve({ slug: 'test' }) }
    );
    const body = await res.json();
    const ids = body.staff.map((s: any) => s.id);
    expect(ids).toContain('staff-1'); // unrestricted
    expect(ids).toContain('staff-2'); // has svc-1 + svc-2
    expect(ids).not.toContain('staff-3'); // missing svc-2
  });

  it('strips serviceAssignments from public response', async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 'staff-1', fullName: 'Alice', role: null, serviceAssignments: [{ serviceId: 'svc-1' }] },
    ] as any);

    const { GET } = await import('@/app/api/public/business/[slug]/staff/route');
    const res = await GET(
      new NextRequest('http://localhost/api/public/business/test/staff'),
      { params: Promise.resolve({ slug: 'test' }) }
    );
    const body = await res.json();
    expect(body.staff[0]).not.toHaveProperty('serviceAssignments');
  });
});

// ---------------------------------------------------------------------------
// 7. public-available-slots: staff_cant_do_service
// ---------------------------------------------------------------------------
describe('getPublicAvailableSlots — staff_cant_do_service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns staff_cant_do_service when staff has restrictions that exclude the service', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      enableOnlineBooking: true,
      timezone: 'America/New_York',
      businessHours: {
        hours: {
          '2': { isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Tuesday
        },
      },
    } as any);
    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: 'svc-requested', duration: 60 },
    ] as any);
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      fullName: 'Alice',
      workDays: [0, 1, 2, 3, 4, 5, 6], // works all days
      serviceAssignments: [{ serviceId: 'svc-other' }], // NOT svc-requested
    } as any);

    const { getPublicAvailableSlots } = await import('@/lib/public-available-slots');
    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test' },
      date: '2026-06-09', // Tuesday
      serviceId: 'svc-requested',
      staffId: 'staff-1',
    });

    expect(result.slots).toHaveLength(0);
    expect(result.availabilityReason).toBe('staff_cant_do_service');
    expect(result.message).toMatch(/does not perform/i);
  });

  it('returns slots normally when staff has no service restrictions', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      enableOnlineBooking: true,
      timezone: 'America/New_York',
      businessHours: {
        hours: {
          '2': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        },
      },
    } as any);
    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: 'svc-any', duration: 60 },
    ] as any);
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      fullName: 'Alice',
      workDays: [0, 1, 2, 3, 4, 5, 6],
      serviceAssignments: [], // no restrictions
    } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

    const { getPublicAvailableSlots } = await import('@/lib/public-available-slots');
    const result = await getPublicAvailableSlots({
      businessLookup: { slug: 'test' },
      date: '2026-06-09',
      serviceId: 'svc-any',
      staffId: 'staff-1',
    });

    // Should not be staff_cant_do_service
    expect(result.availabilityReason).not.toBe('staff_cant_do_service');
  });
});
